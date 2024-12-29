import { NextResponse } from 'next/server';

// 註冊新指紋
export async function POST() {
  try {
    // 這裡需要實現與 ESP32 的通信邏輯
    // 臨時返回成功消息
    return NextResponse.json({ message: '請將手指放在感應器上...' });
  } catch (error) {
    return NextResponse.json(
      { error: '註冊指紋失敗' },
      { status: 500 }
    );
  }
} 