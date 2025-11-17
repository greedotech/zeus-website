// app/api/recaptcha/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, error: "Missing reCAPTCHA token" }, { status: 400 });
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY!;
    const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";

    const response = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();

    if (!data.success) {
      return NextResponse.json({ success: false, error: "reCAPTCHA verification failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("reCAPTCHA API error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}