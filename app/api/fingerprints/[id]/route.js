import { NextResponse } from 'next/server';

// 刪除指紋
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    // 這裡需要實現與 ESP32 的通信邏輯
    
    return NextResponse.json({ message: '指紋刪除成功' });
  } catch (error) {
    return NextResponse.json(
      { error: '刪除指紋失敗' },
      { status: 500 }
    );
  }
} 