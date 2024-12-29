'use client';
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AttendancePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showOffcanvas, setShowOffcanvas] = useState(false);
  const [punchResult, setPunchResult] = useState(null);

  // 打卡
  const checkAttendance = async () => {
    try {
      setIsLoading(true);
      setMessage('請放置手指...');

      const response = await fetch(`${process.env.NEXT_PUBLIC_ESP32_URL}/api/fingerprints/verify`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        // 獲取員工信息
        const { data: employee, error: employeeError } = await supabase
          .from('employees')
          .select('*')
          .eq('fingerprint_id', data.fingerprintId)
          .single();

        if (employeeError) {
          if (employeeError.code === 'PGRST116') {
            setMessage('此指紋未註冊員工信息');
            setPunchResult({ success: false, message: '此指紋未註冊員工信息' });
            setShowOffcanvas(true);
            return;
          }
          throw employeeError;
        }

        // 檢查今天的打卡記錄
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: todayRecords, error: recordsError } = await supabase
          .from('attendance_records')
          .select('type')
          .eq('employee_id', employee.id)
          .gte('created_at', today.toISOString())
          .order('created_at', { ascending: true });

        if (recordsError) throw recordsError;

        // 決定打卡類型
        let type;
        if (todayRecords.length === 0) {
          type = 'in';  // 第一次打卡為上班
        } else if (todayRecords.length === 1 && todayRecords[0].type === 'in') {
          type = 'out';  // 第二次打卡為下班
        } else {
          setPunchResult({ 
            success: false, 
            message: '今天已完成上下班打卡',
            employee: employee
          });
          setShowOffcanvas(true);
          return;
        }

        // 記錄打卡
        const { error: attendanceError } = await supabase
          .from('attendance_records')
          .insert([{
            employee_id: employee.id,
            status: 'present',
            type: type
          }]);

        if (attendanceError) throw attendanceError;
        
        setPunchResult({
          success: true,
          message: `${type === 'in' ? '上班' : '下班'}打卡成功！`,
          employee: employee,
          type: type,
          time: new Date().toLocaleTimeString()
        });
        setShowOffcanvas(true);
      } else {
        setPunchResult({ 
          success: false, 
          message: data.error || '指紋驗證失敗' 
        });
        setShowOffcanvas(true);
      }
    } catch (error) {
      console.error('Error during attendance check:', error);
      setPunchResult({ 
        success: false, 
        message: typeof error === 'string' ? error : '打卡失敗' 
      });
      setShowOffcanvas(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">指紋打卡系統</h1>
      
      {/* 消息提示 */}
      {message && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4">
          {message}
        </div>
      )}

      {/* 打卡按鈕 */}
      <div className="flex justify-center mb-8">
        <button
          onClick={checkAttendance}
          disabled={isLoading}
          className="bg-green-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-green-600 disabled:opacity-50 transition-colors"
        >
          {isLoading ? '處理中...' : '打卡'}
        </button>
      </div>

      {/* Offcanvas 提示框 */}
      {showOffcanvas && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90%] transform transition-all duration-300 ease-in-out">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h3 className="text-xl font-semibold text-gray-800">打卡結果</h3>
                <button
                  onClick={() => setShowOffcanvas(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className={`p-4 mb-6 rounded-lg ${
                punchResult?.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <p className={`font-medium flex items-center ${
                  punchResult?.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {punchResult?.success ? (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {punchResult?.message}
                </p>
              </div>

              {punchResult?.success && punchResult?.employee && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-xl font-semibold text-gray-900">{punchResult.employee.name}</p>
                    <p className="text-gray-600">{punchResult.employee.department || ''}</p>
                    <p className="text-gray-600">{punchResult.employee.position || ''}</p>
                    <p className="text-lg font-medium mt-4">
                      {punchResult.time}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowOffcanvas(false)}
                className="w-full mt-6 py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 