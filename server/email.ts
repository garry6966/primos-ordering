import { Resend } from "resend";

const NOTIFY_EMAIL = process.env.ORDER_EMAIL || "orderprimos@gmail.com";
const FROM_ADDRESS = "Primo's Orders <orders@orderprimosfood.com>";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not set — emails will not be sent. Set this env var on Railway.");
    return null;
  }
  if (!apiKey.startsWith("re_")) {
    console.warn("[Email] RESEND_API_KEY doesn't start with 're_' — may be invalid.");
  }
  return new Resend(apiKey);
}

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  orderType: "delivery" | "collection";
  deliveryAddress?: string | null;
  items: Array<{
    name: string;
    quantity: number;
    totalPrice: number;
    toppings?: Array<{ name: string; price: number }>;
    mealDeal?: string | null;
  }>;
  subtotal: string;
  deliveryFee: string;
  total: string;
  notes?: string | null;
  createdAt?: Date;
}

function buildEmailHtml(order: OrderEmailData): string {
  const orderTime = order.createdAt
    ? new Date(order.createdAt).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        dateStyle: "full",
        timeStyle: "short",
      })
    : new Date().toLocaleString("en-GB", {
        timeZone: "Europe/London",
        dateStyle: "full",
        timeStyle: "short",
      });

  const itemsHtml = order.items
    .map((item) => {
      const toppingLines =
        item.toppings && item.toppings.length > 0
          ? `<div style="font-size:13px;color:#666;margin-top:2px;padding-left:12px;">+ ${item.toppings.map((t) => t.name).join(", ")}</div>`
          : "";
      const mealDealLine = item.mealDeal
        ? `<div style="font-size:13px;color:#E31837;margin-top:2px;padding-left:12px;">${item.mealDeal === "chips_drink" ? "Meal Deal: Chips + Soft Drink" : "Meal Deal: Chips + Milkshake"}</div>`
        : "";
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;vertical-align:top;">
            <div style="font-weight:600;font-size:15px;">${item.quantity}&times; ${item.name}</div>
            ${toppingLines}
            ${mealDealLine}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;vertical-align:top;font-weight:600;white-space:nowrap;">
            &pound;${(item.totalPrice * item.quantity).toFixed(2)}
          </td>
        </tr>`;
    })
    .join("");

  const deliveryFeeNum = parseFloat(order.deliveryFee);
  const deliveryFeeDisplay =
    order.orderType === "delivery"
      ? deliveryFeeNum === 0
        ? `<span style="color:#16a34a;font-weight:600;">FREE</span>`
        : `&pound;${deliveryFeeNum.toFixed(2)}`
      : "N/A";

  const deliveryRow =
    order.orderType === "delivery" && order.deliveryAddress
      ? `<tr>
          <td style="padding:6px 0;color:#555;">Delivery Address</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${order.deliveryAddress}</td>
        </tr>`
      : "";

  const emailRow = order.customerEmail
    ? `<tr>
        <td style="padding:6px 0;color:#555;">Email</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;">${order.customerEmail}</td>
      </tr>`
    : "";

  const notesSection = order.notes
    ? `<tr><td colspan="2" style="padding:16px 28px 0;">
        <div style="padding:12px 16px;background:#fff8e1;border-left:4px solid #f59e0b;border-radius:4px;">
          <div style="font-weight:700;font-size:13px;color:#92400e;margin-bottom:4px;">CUSTOMER NOTES</div>
          <div style="font-size:14px;color:#78350f;">${order.notes}</div>
        </div>
      </td></tr>`
    : "";

  const typeColor = order.orderType === "delivery" ? "#E31837" : "#1d4ed8";
  const typeLabel = order.orderType === "delivery" ? "&#x1F697; Delivery" : "&#x1F3EA; Collection";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>New Order &ndash; ${order.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#E31837;padding:24px 28px;text-align:center;">
            <div style="font-size:34px;font-weight:900;font-style:italic;color:#ffffff;letter-spacing:-1px;">PRIMO&apos;S</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">New Order Received</div>
          </td>
        </tr>

        <!-- Order badge -->
        <tr>
          <td style="padding:20px 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fff5f5;border:2px solid #E31837;border-radius:8px;padding:14px 18px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <div style="font-size:11px;font-weight:700;color:#E31837;text-transform:uppercase;letter-spacing:1px;">Order Number</div>
                        <div style="font-size:22px;font-weight:800;color:#111;margin-top:2px;">${order.orderNumber}</div>
                      </td>
                      <td style="text-align:right;">
                        <span style="display:inline-block;background:${typeColor};color:#fff;font-size:13px;font-weight:700;padding:6px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:0.5px;">${typeLabel}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Customer details -->
        <tr>
          <td style="padding:20px 28px 0;">
            <div style="font-size:12px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Customer Details</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
              <tr>
                <td style="padding:6px 0;color:#555;width:40%;">Name</td>
                <td style="padding:6px 0;text-align:right;font-weight:600;">${order.customerName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#555;">Phone</td>
                <td style="padding:6px 0;text-align:right;font-weight:600;">${order.customerPhone}</td>
              </tr>
              ${emailRow}
              ${deliveryRow}
              <tr>
                <td style="padding:6px 0;color:#555;">Time</td>
                <td style="padding:6px 0;text-align:right;font-weight:600;">${orderTime}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Items -->
        <tr>
          <td style="padding:20px 28px 0;">
            <div style="font-size:12px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Items Ordered</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
              ${itemsHtml}
            </table>
          </td>
        </tr>

        <!-- Totals -->
        <tr>
          <td style="padding:16px 28px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
              <tr>
                <td style="padding:5px 0;color:#555;">Subtotal</td>
                <td style="padding:5px 0;text-align:right;">&pound;${parseFloat(order.subtotal).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#555;">Delivery fee</td>
                <td style="padding:5px 0;text-align:right;">${deliveryFeeDisplay}</td>
              </tr>
              <tr>
                <td style="padding:10px 0 0;font-size:18px;font-weight:800;border-top:2px solid #111;">Total</td>
                <td style="padding:10px 0 0;text-align:right;font-size:18px;font-weight:800;border-top:2px solid #111;color:#E31837;">&pound;${parseFloat(order.total).toFixed(2)}</td>
              </tr>
            </table>
          </td>
        </tr>

        ${notesSection}

        <!-- Footer -->
        <tr>
          <td style="padding:24px 28px;text-align:center;border-top:1px solid #f0f0f0;margin-top:20px;">
            <div style="font-size:12px;color:#aaa;">6 Groathill Road North, Edinburgh EH4 2SW</div>
            <div style="font-size:12px;color:#aaa;margin-top:2px;">0131 563 4457 &middot; orderprimos@gmail.com</div>
            <div style="font-size:11px;color:#ccc;margin-top:8px;">Sent automatically by the Primo&apos;s ordering system.</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildPlainText(order: OrderEmailData): string {
  const orderTime = order.createdAt
    ? new Date(order.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" })
    : new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });

  const itemLines = order.items
    .map((item) => {
      let line = `  ${item.quantity}x ${item.name} — £${(item.totalPrice * item.quantity).toFixed(2)}`;
      if (item.toppings && item.toppings.length > 0) {
        line += `\n    Toppings: ${item.toppings.map((t) => t.name).join(", ")}`;
      }
      if (item.mealDeal) {
        line += `\n    ${item.mealDeal === "chips_drink" ? "Meal Deal: Chips + Soft Drink" : "Meal Deal: Chips + Milkshake"}`;
      }
      return line;
    })
    .join("\n");

  const deliveryFeeNum = parseFloat(order.deliveryFee);

  return `NEW ORDER — PRIMO'S
====================
Order: ${order.orderNumber}
Type:  ${order.orderType === "delivery" ? "DELIVERY" : "COLLECTION"}
Time:  ${orderTime}

CUSTOMER
--------
Name:  ${order.customerName}
Phone: ${order.customerPhone}
${order.customerEmail ? `Email: ${order.customerEmail}\n` : ""}${order.deliveryAddress ? `Address: ${order.deliveryAddress}\n` : ""}
ITEMS
-----
${itemLines}

TOTALS
------
Subtotal:     £${parseFloat(order.subtotal).toFixed(2)}
Delivery fee: ${order.orderType === "delivery" ? (deliveryFeeNum === 0 ? "FREE" : `£${deliveryFeeNum.toFixed(2)}`) : "N/A"}
TOTAL:        £${parseFloat(order.total).toFixed(2)}
${order.notes ? `\nNOTES: ${order.notes}` : ""}
--
Primo's · 6 Groathill Road North, Edinburgh EH4 2SW · 0131 563 4457
`;
}

export async function sendOrderNotificationEmail(order: OrderEmailData): Promise<boolean> {
  console.log(`[Email] sendOrderNotificationEmail called for ${order.orderNumber}`);
  console.log(`[Email] RESEND_API_KEY present: ${!!process.env.RESEND_API_KEY}, starts with re_: ${process.env.RESEND_API_KEY?.startsWith("re_")}`);
  console.log(`[Email] Sending to: ${NOTIFY_EMAIL}, from: ${FROM_ADDRESS}`);

  const resend = getResend();
  if (!resend) {
    console.error(`[Email] Cannot send — Resend client not initialized (missing API key)`);
    return false;
  }

  try {
    const subject = `🍕 New ${order.orderType === "delivery" ? "Delivery" : "Collection"} Order — ${order.orderNumber} — £${parseFloat(order.total).toFixed(2)}`;

    console.log(`[Email] Calling resend.emails.send() with subject: ${subject}`);
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: NOTIFY_EMAIL,
      subject,
      text: buildPlainText(order),
      html: buildEmailHtml(order),
    });

    if (error) {
      console.error("[Email] Resend API returned error:", JSON.stringify(error));
      return false;
    }

    console.log(`[Email] Order notification SENT successfully for ${order.orderNumber}. ID: ${data?.id || "unknown"}`);
    return true;
  } catch (err: any) {
    console.error("[Email] Exception during send:", err.message, err.stack);
    return false;
  }
}

export interface ReviewRequestEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ name: string; quantity: number }>;
  stampCount: number;
}

function buildReviewRequestHtml(data: ReviewRequestEmailData): string {
  // Use the Railway deployed URL for the review link
  const siteUrl = process.env.SITE_URL || "https://orderprimosfood.com";
  const reviewLink = `${siteUrl}/reviews?order=${encodeURIComponent(data.orderNumber)}`;

  const itemsList = data.items
    .map(item => `<li style="padding:4px 0;font-size:14px;">${item.quantity}&times; ${item.name}</li>`)
    .join("");

  const loyaltySection = `
    <tr>
      <td style="padding:16px 28px;">
        <div style="background:#fff8e1;border-radius:8px;padding:16px 20px;border:1px solid #f59e0b;">
          <div style="font-size:13px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">&#x2B50; Your Loyalty Stamps</div>
          <div style="font-size:20px;font-weight:800;color:#78350f;">${data.stampCount}/10</div>
          <div style="font-size:12px;color:#92400e;margin-top:4px;">${data.stampCount >= 10 ? "You have enough stamps for £10 off your next order!" : `${10 - data.stampCount} more stamp${10 - data.stampCount === 1 ? "" : "s"} until you earn £10 off!`}</div>
        </div>
      </td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>How was your order? &ndash; ${data.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#E31837;padding:24px 28px;text-align:center;">
            <div style="font-size:34px;font-weight:900;font-style:italic;color:#ffffff;letter-spacing:-1px;">PRIMO&apos;S</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">We&apos;d love your feedback!</div>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 28px 8px;">
            <div style="font-size:18px;font-weight:700;color:#111;">Hi ${data.customerName}! &#x1F44B;</div>
            <div style="font-size:14px;color:#555;margin-top:8px;line-height:1.5;">
              Thanks for your recent order <strong>${data.orderNumber}</strong>. We hope you enjoyed your meal!
            </div>
          </td>
        </tr>

        <!-- Order summary -->
        <tr>
          <td style="padding:8px 28px 16px;">
            <div style="font-size:12px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Your Order</div>
            <ul style="margin:0;padding-left:20px;color:#333;">
              ${itemsList}
            </ul>
          </td>
        </tr>

        ${loyaltySection}

        <!-- CTA -->
        <tr>
          <td style="padding:16px 28px 24px;text-align:center;">
            <a href="${reviewLink}" style="display:inline-block;background:#E31837;color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:8px;text-decoration:none;">Leave a Review &#x2B50;</a>
            <div style="font-size:12px;color:#999;margin-top:12px;">It only takes 30 seconds and helps us improve!</div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 28px;text-align:center;border-top:1px solid #f0f0f0;">
            <div style="font-size:12px;color:#aaa;">6 Groathill Road North, Edinburgh EH4 2SW</div>
            <div style="font-size:12px;color:#aaa;margin-top:2px;">0131 563 4457 &middot; orderprimos@gmail.com</div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildReviewRequestPlainText(data: ReviewRequestEmailData): string {
  const siteUrl = process.env.SITE_URL || "https://orderprimosfood.com";
  const reviewLink = `${siteUrl}/reviews?order=${encodeURIComponent(data.orderNumber)}`;
  const itemsList = data.items.map(item => `  ${item.quantity}x ${item.name}`).join("\n");

  return `Hi ${data.customerName}!

Thanks for your recent order ${data.orderNumber}. We hope you enjoyed your meal!

Your Order:
${itemsList}

YOUR LOYALTY STAMPS: ${data.stampCount}/10
${data.stampCount >= 10 ? "You have enough stamps for £10 off your next order!" : `${10 - data.stampCount} more stamp${10 - data.stampCount === 1 ? "" : "s"} until you earn £10 off!`}

Would you take a moment to share your experience? It helps us improve and helps other customers too.

Leave a review here: ${reviewLink}

--
Primo's · 6 Groathill Road North, Edinburgh EH4 2SW · 0131 563 4457
`;
}

// ========== Order Rejection Email ==========
export interface OrderRejectionEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
}

function buildRejectionEmailHtml(data: OrderRejectionEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Order Update &ndash; ${data.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#E31837;padding:24px 28px;text-align:center;">
            <div style="font-size:34px;font-weight:900;font-style:italic;color:#ffffff;letter-spacing:-1px;">PRIMO&apos;S</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">Order Update</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:12px;">Hi ${data.customerName},</div>
            <div style="font-size:14px;color:#555;line-height:1.6;margin-bottom:16px;">
              We&apos;re sorry but we&apos;re unable to accept your order <strong>${data.orderNumber}</strong> at this moment.
            </div>
            <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:14px 18px;margin-bottom:16px;">
              <div style="font-size:14px;font-weight:600;color:#166534;">Your card has NOT been charged.</div>
              <div style="font-size:13px;color:#15803d;margin-top:4px;">The hold on your card will be released shortly.</div>
            </div>
            <div style="font-size:14px;color:#555;line-height:1.6;margin-bottom:8px;">
              Please try again later or call us on <strong>0131 563 4457</strong>.
            </div>
            <div style="font-size:14px;color:#555;line-height:1.6;">We apologise for any inconvenience.</div>
            <div style="font-size:14px;color:#333;font-weight:600;margin-top:20px;">&mdash; Primo&apos;s Kitchen</div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px;text-align:center;border-top:1px solid #f0f0f0;">
            <div style="font-size:12px;color:#aaa;">6 Groathill Road North, Edinburgh EH4 2SW</div>
            <div style="font-size:12px;color:#aaa;margin-top:2px;">0131 563 4457 &middot; orderprimos@gmail.com</div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildRejectionPlainText(data: OrderRejectionEmailData): string {
  return `Hi ${data.customerName},\n\nWe're sorry but we're unable to accept your order ${data.orderNumber} at this moment.\n\nYour card has NOT been charged. The hold on your card will be released shortly.\n\nPlease try again later or call us on 0131 563 4457.\n\nWe apologise for any inconvenience.\n\n\u2014 Primo's Kitchen\n6 Groathill Road North, Edinburgh EH4 2SW\n0131 563 4457\n`;
}

export async function sendOrderRejectionEmail(data: OrderRejectionEmailData): Promise<boolean> {
  console.log(`[Email] sendOrderRejectionEmail called for ${data.orderNumber} to ${data.customerEmail}`);

  const resend = getResend();
  if (!resend) {
    console.error(`[Email] Cannot send rejection email — Resend client not initialized`);
    return false;
  }

  try {
    const { data: responseData, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: data.customerEmail,
      subject: `Order Update \u2014 ${data.orderNumber}`,
      text: buildRejectionPlainText(data),
      html: buildRejectionEmailHtml(data),
    });

    if (error) {
      console.error("[Email] Rejection email Resend API error:", JSON.stringify(error));
      return false;
    }

    console.log(`[Email] Rejection email SENT for ${data.orderNumber} to ${data.customerEmail}. ID: ${responseData?.id || "unknown"}`);

    // Also notify the owner
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: NOTIFY_EMAIL,
      subject: `Order Rejected \u2014 ${data.orderNumber}`,
      text: `Order ${data.orderNumber} for ${data.customerName} has been rejected. Payment hold released.`,
    });

    return true;
  } catch (err: any) {
    console.error("[Email] Rejection email exception:", err.message, err.stack);
    return false;
  }
}

export async function sendReviewRequestEmail(data: ReviewRequestEmailData): Promise<boolean> {
  console.log(`[Email] sendReviewRequestEmail called for ${data.orderNumber} to ${data.customerEmail}`);

  const resend = getResend();
  if (!resend) {
    console.error(`[Email] Cannot send review request — Resend client not initialized`);
    return false;
  }

  try {
    const { data: responseData, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: data.customerEmail,
      subject: `How was your order? Leave us a review! ⭐ — ${data.orderNumber}`,
      text: buildReviewRequestPlainText(data),
      html: buildReviewRequestHtml(data),
    });

    if (error) {
      console.error("[Email] Review request Resend API error:", JSON.stringify(error));
      return false;
    }

    console.log(`[Email] Review request SENT to ${data.customerEmail} for ${data.orderNumber}. ID: ${responseData?.id || "unknown"}`);
    return true;
  } catch (err: any) {
    console.error("[Email] Review request exception:", err.message, err.stack);
    return false;
  }
}
