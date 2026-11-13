import { NextResponse } from "next/server";

export async function GET() {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json(
      {
        error: {
          code: "CONFIG_ERROR",
          message: "VAPID public key belum dikonfigurasi",
        },
      },
      { status: 500 }
    );
  }
  return NextResponse.json({
    data: { vapidPublicKey: publicKey },
  });
}
