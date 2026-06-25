import { describe, expect, it } from "vitest";
import { Resend } from "resend";

describe("Resend API key validation", () => {
  it("RESEND_API_KEY is set in environment", () => {
    expect(process.env.RESEND_API_KEY).toBeTruthy();
    expect(process.env.RESEND_API_KEY).toMatch(/^re_/);
  });

  it("Resend client can be instantiated with the API key", () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(() => new Resend(apiKey)).not.toThrow();
  });

  it("Resend API key is valid and can send emails (test send to delivered@resend.dev)", async () => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Resend's official test address — always succeeds with a valid key, never actually delivers
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: "delivered@resend.dev",
      subject: "Primo's — API key validation test",
      text: "This is an automated test to confirm the Resend API key is valid.",
    });
    // A valid sending key returns an id; an invalid key returns an auth error
    if (error) {
      console.error("Resend error:", JSON.stringify(error));
    }
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.id).toBeTruthy();
  });
});
