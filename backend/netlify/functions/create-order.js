import { Cashfree } from "cashfree-pg";
import Razorpay from "razorpay";
import crypto from "crypto";

// Note: In Netlify, these are set in the UI Environment Variables
// We use a helper to ensure they are available
const getCashfreeConfig = () => ({
  appId: process.env.CASHFREE_APP_ID,
  secretKey: process.env.CASHFREE_SECRET_KEY,
  environment: process.env.CASHFREE_ENVIRONMENT === "PRODUCTION" ? "PRODUCTION" : "SANDBOX"
});

export const handler = async (event, context) => {
  // CORS Headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" }) 
    };
  }

  try {
    const { amount, customerId, customerPhone, customerEmail, gateway, orderId } = JSON.parse(event.body);
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid amount" })
      };
    }

    const finalOrderId = orderId || `order_${Date.now()}`;
    console.log(`[DEBUG] Creating ${gateway} order: ${finalOrderId} for amount: ${amount}`);

    if (gateway === "cashfree") {
      const config = getCashfreeConfig();
      if (!config.appId || !config.secretKey) {
        throw new Error("Cashfree credentials not configured in environment");
      }

      Cashfree.XClientId = config.appId;
      Cashfree.XClientSecret = config.secretKey;
      Cashfree.XEnvironment = config.environment === "PRODUCTION" 
        ? Cashfree.Environment.PRODUCTION 
        : Cashfree.Environment.SANDBOX;

      const request = {
        order_id: finalOrderId,
        order_amount: parseFloat(amount),
        order_currency: "INR",
        customer_details: {
          customer_id: String(customerId || `cust_${Date.now()}`),
          customer_phone: String(customerPhone || "9999999999"),
          customer_email: customerEmail || "customer@example.com",
          customer_name: "Customer"
        },
        order_meta: {
           // Netlify might not have headers.origin easily available in all contexts, but event.headers.origin is standard
           return_url: `${event.headers.origin || "https://example.com"}/transactions?order_id={order_id}`
        }
      };

      console.log("[DEBUG] Cashfree Payload:", JSON.stringify(request));
      const response = await Cashfree.PGCreateOrder("2023-08-01", request);
      console.log("[DEBUG] Cashfree Response:", JSON.stringify(response.data));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response.data)
      };
    } 
    
    if (gateway === "payu") {
      const merchantKey = process.env.PAYU_MERCHANT_KEY;
      const salt = process.env.PAYU_SALT;
      
      if (!merchantKey || !salt) {
        throw new Error("PayU credentials not configured in environment");
      }

      const txnid = finalOrderId;
      const productinfo = "Payment for order " + txnid;
      const firstname = "Customer";
      const email = customerEmail || "customer@example.com";
      
      // Hash sequence: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
      const hashString = `${merchantKey}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
      const hash = crypto.createHash("sha512").update(hashString).digest("hex");

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          hash,
          merchantKey,
          txnid,
          amount,
          productinfo,
          firstname,
          email,
          action: process.env.PAYU_ENVIRONMENT === "PRODUCTION" 
            ? "https://secure.payu.in/_payment" 
            : "https://test.payu.in/_payment"
        })
      };
    }

    if (gateway === "razorpay") {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        throw new Error("Razorpay credentials not configured in environment");
      }

      const instance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const options = {
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: finalOrderId,
      };

      const order = await instance.orders.create(options);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(order)
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid or missing gateway specified. Options: cashfree, payu, razorpay" })
    };

  } catch (error) {
    console.error("[ERROR] Order Creation Failed:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: "Failed to create order", 
        message: error.message,
        details: error.response?.data || null
      })
    };
  }
};
