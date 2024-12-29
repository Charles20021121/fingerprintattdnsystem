import { NextResponse } from 'next/server';

// 獲取已註冊的指紋列表
export async function GET() {
  try {
    // 這裡需要實現與 ESP32 的通信邏輯
    // 臨時返回模擬數據
    const fingerprints = [
      { id: 1 },
      { id: 2 },
      { id: 3 }
    ];
    
    return NextResponse.json(fingerprints);
  } catch (error) {
    return NextResponse.json(
      { error: '獲取指紋列表失敗' },
      { status: 500 }
    );
  }
} 