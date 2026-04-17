# 🚨 CRITICAL: RAZORPAY SECRET KEY REQUIRED

## Current Status
✅ **Key ID Configured**: `rzp_test_Sd1WjWnmy9yKhm`  
❌ **Secret Key Missing**: `RAZORPAY_KEY_SECRET` not set in `.env`

## How to Get Your Razorpay Secret Key

### For TEST Mode (Current):
1. Go to: https://dashboard.razorpay.com/app/keys
2. Make sure you're in **Test Mode** (toggle at top)
3. Copy **Key Secret** (you may need to click "Generate Secret" if not visible)
4. Update `.env` file:
   ```env
   RAZORPAY_KEY_SECRET=your_test_secret_key_here
   ```

### For LIVE Mode (Production Launch):
1. Complete Razorpay KYC verification
2. Switch to **Live Mode** in dashboard
3. Generate live credentials
4. Update `.env` file:
   ```env
   RAZORPAY_KEY_ID=rzp_live_YOUR_LIVE_KEY
   RAZORPAY_KEY_SECRET=your_live_secret_key_here
   ```

## Testing Without Secret Key

The Razorpay endpoint will return signature validation errors if the secret key is missing.

To test the endpoint structure without a valid secret:
```bash
curl -X POST http://localhost:3000/api/billing/verify-razorpay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "razorpay_payment_id": "pay_test123",
    "razorpay_order_id": "order_test123", 
    "razorpay_signature": "fake_signature",
    "plan": "pro",
    "amount": 19900
  }'
```

Expected response (without secret key):
```json
{
  "success": false,
  "error": "Invalid payment signature"
}
```

## Security Warning

⚠️ **NEVER** commit secret keys to version control!
- `.env` is in `.gitignore` ✅
- For production, use environment variables or secrets manager
- Rotate keys if accidentally exposed
