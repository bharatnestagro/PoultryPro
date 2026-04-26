import { GoogleGenerativeAI } from "@google/generative-ai";
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// Rule Constants (Defaults are now in the runAutoAlertEngine function)
export interface AutoAlertParams {
  flockId: string;
  userId: string;
  farmType: string;
  data: any;
  weather?: {
    temp: number;
    humidity: number;
    description: string;
  };
}

export async function runAutoAlertEngine(params: AutoAlertParams) {
  const { flockId, userId, farmType, data, weather } = params;
  const alerts: any[] = [];

  // 0. Fetch Engine Configuration
  let thresholds = {
    feedMin: 0.11,
    feedMax: 0.13,
    heatStressTemp: 38,
    criticalMortalityRate: 0.02,
    badEggThreshold: 0.05
  };

  try {
    const settingsSnap = await getDoc(doc(db, 'system', 'autoAlertSettings'));
    if (settingsSnap.exists() && settingsSnap.data().thresholds) {
      thresholds = { ...thresholds, ...settingsSnap.data().thresholds };
    }
  } catch (e) {
    console.error("Failed to load engine thresholds, using defaults:", e);
  }

  // 1. Logic: Feed vs Body Weight
  if (Number(data.consumption?.feedIntake) > 0 && Number(data.production?.avgWeight) > 0) {
    const flockSnap = await getDoc(doc(db, 'flocks', flockId));
    if (flockSnap.exists()) {
      const flock = flockSnap.data();
      const currentCount = Number(flock.currentCount) || 0;
      
      const feedIntake = Number(data.consumption.feedIntake);
      const weightGrams = Number(data.production.avgWeight);
      
      const feedPerBirdGrams = (feedIntake * 1000) / (currentCount || 1);
      const minRequired = weightGrams * thresholds.feedMin;
      const maxRequired = weightGrams * thresholds.feedMax;

      if (feedPerBirdGrams < minRequired) {
        alerts.push({
          title: "Low Feed Intake Warning",
          description: `Birds are consuming ${feedPerBirdGrams.toFixed(1)}g, which is below the recommended ${minRequired.toFixed(1)}g for their weight.`,
          priority: "Medium",
          condition: "Under-feeding detected",
          treatment: "Check for feed accessibility or underlying health issues."
        });
      } else if (feedPerBirdGrams > maxRequired) {
        alerts.push({
          title: "High Feed Consumption",
          description: `Birds are consuming ${feedPerBirdGrams.toFixed(1)}g, exceeding the ${maxRequired.toFixed(1)}g target. Check for waste or growth plateau.`,
          priority: "Low",
          condition: "Over-feeding or waste",
          treatment: "Calibrate feeders and check for spillages."
        });
      }
    }
  }

  // 2. Logic: Mortality Spike
  const dailyMortality = Number(data.health?.mortality) || 0;
  if (dailyMortality > 0) {
    try {
      const flockSnap = await getDoc(doc(db, 'flocks', flockId));
      if (flockSnap.exists()) {
        const flock = flockSnap.data();
        const countAtStart = Number(flock.currentCount) || 1;
        const mortalityRate = dailyMortality / countAtStart;
        
        if (mortalityRate >= thresholds.criticalMortalityRate) {
          alerts.push({
            title: "Critical Mortality Spike",
            description: `${dailyMortality} birds died today (${(mortalityRate * 100).toFixed(1)}%). This is a critical spike above the ${(thresholds.criticalMortalityRate * 100).toFixed(1)}% threshold.`,
            priority: "High",
            condition: "Acute mortality increase",
            treatment: "Isolate affected birds immediately, check water/feed quality, and consult a vet."
          });
        }
      }
    } catch (e) {
      console.error("Mortality check failed:", e);
    }
  }

  // 3. Logic: Bad Eggs (Layer Farm specific)
  const badEggs = Number(data.production?.badEggs);
  const eggCount = Number(data.production?.eggCount);
  if (badEggs > 0 && eggCount > 0) {
    const badEggRatio = badEggs / eggCount;
    if (badEggRatio >= thresholds.badEggThreshold) {
      alerts.push({
        title: "High Shell Quality Warning",
        description: `${(badEggRatio * 100).toFixed(1)}% of eggs today are damaged or bad.`,
        priority: "Medium",
        condition: "Potential nutritional deficiency",
        treatment: "Check calcium and phosphorus levels in feed. Ensure birds aren't stressed."
      });
    }
  }

  // 4. Logic: Weather + Consumption (Heat Stress)
  const airTemp = Number(weather?.temp) || 0;
  if (airTemp > thresholds.heatStressTemp) {
    alerts.push({
      title: "Active Heat Stress Alert",
      description: `Current temperature is ${airTemp}°C. High risk of heat stroke above ${thresholds.heatStressTemp}°C.`,
      priority: "High",
      condition: "Extreme Temperature",
      treatment: "Increase ventilation, use foggers, and ensure cool water is available."
    });
  }

  // 4. Advanced Diagnosis via Gemini (Optional but Powerful)
  if (alerts.length > 0 || data.health?.symptoms) {
    try {
      const diagnosis = await runGeminiDiagnosis(params);
      if (diagnosis && (diagnosis.priority || diagnosis.title) && diagnosis.priority !== "None") {
        alerts.push(diagnosis);
      }
    } catch (e) {
      console.error("Gemini diagnosis engine failed:", e);
    }
  }

  // Save alerts to Firestore
  for (const alert of alerts) {
    try {
      await addDoc(collection(db, 'systemAlerts'), {
        ...alert,
        target: farmType,
        active: true,
        isAuto: true,
        sourceLogId: data.id || 'new_log',
        userId: userId, 
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to save auto-alert:", e);
    }
  }

  return alerts;
}

async function runGeminiDiagnosis(params: AutoAlertParams) {
  // Fetch dynamic settings and rules from Firestore
  let apiKey = process.env.GEMINI_API_KEY;
  let promptTemplate = `
    As a Poultry Health AI, analyze this daily log data and provide a smart diagnosis alert if needed.
    Farm Type: {{farmType}}
    Chicks Data: {{data}}
    Weather Data: {{weather}}

    Additionally, the admin has set these Custom Logic Rules:
    {{rules}}

    If any of the log data violates/meets the conditions in the Custom Logic Rules OR if you detect any other health issue return a JSON object:
    {
      "title": "Short title",
      "description": "Short explanation",
      "priority": "Low/Medium/High",
      "condition": "The detected problem/rule matched",
      "treatment": "Recommended action"
    }
    If no issues, return {"priority": "None"}.
    Only return valid JSON.
  `;

  let customRulesStr = "None defined.";
  try {
    const settingsSnap = await getDoc(doc(db, 'system', 'autoAlertSettings'));
    const rulesSnap = await getDocs(query(collection(db, 'alertRules'), where('active', '==', true)));

    if (settingsSnap.exists()) {
      const settingsData = settingsSnap.data();
      if (settingsData.geminiApiKey && settingsData.geminiApiKey.length > 10) {
        apiKey = settingsData.geminiApiKey;
      }
      if (settingsData.aiPrompt) {
        promptTemplate = settingsData.aiPrompt;
      }
    }

    if (!rulesSnap.empty) {
      customRulesStr = rulesSnap.docs.map(d => `- RULE: ${d.data().name}: ${d.data().logic}`).join('\n');
    }
  } catch (e) {
    console.error("Failed to fetch engine settings or rules:", e);
  }

  // Basic check for API Key
  if (!apiKey || apiKey === "" || apiKey.includes("your-api-key") || apiKey.includes("MY_GEMINI_API_KEY")) {
    console.warn("Valid Gemini API key not found. AI diagnosis skipped.");
    return null;
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Multi-replace support via split/join
    const prompt = promptTemplate
      .split('{{farmType}}').join(params.farmType || 'General Farm')
      .split('{{data}}').join(JSON.stringify(params.data))
      .split('{{weather}}').join(JSON.stringify(params.weather || {}))
      .split('{{rules}}').join(customRulesStr);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean and parse JSON safely using regex to extract the first { ... } block
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const cleanedJson = jsonMatch[0];
      return JSON.parse(cleanedJson);
    }
    
    // Fallback if no JSON found but text might be raw JSON
    try {
        return JSON.parse(text.trim());
    } catch {
        return null;
    }
  } catch (e) {
    console.error("Gemini API call failed:", e);
    return null;
  }
}

export async function fetchWeather(lat: number, lon: number) {
  // Use a public weather API or mock if no key
  // For this demo, we'll try to fetch or return a fallback
  try {
     const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m`);
     const data = await res.json();
     return {
        temp: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        feelsLike: data.current.apparent_temperature,
        windSpeed: data.current.wind_speed_10m,
        description: "Outdoor conditions"
     };
  } catch (e) {
    return { temp: 30, humidity: 60, description: "Weather service unavailable" };
  }
}
