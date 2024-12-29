'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客戶端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function generateEmployeeId() {
  const timestamp = Date.now().toString();
  return 'EMP' + timestamp.slice(-6);
}

export default function Home() {
  const [fingerprints, setFingerprints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [employeeData, setEmployeeData] = useState({
    name: '',
    employee_id: '',
    department: '',
    position: '',
    salary: '',
  });

  // 獲取已註冊的指紋列表
  const fetchFingerprints = async () => {
    try {
      setIsLoading(true);
      // 首先從 ESP32 獲取指紋列表
      const response = await fetch(`${process.env.NEXT_PUBLIC_ESP32_URL}/api/fingerprints`, {
        headers: {
          'Accept': 'application/json',
        },
      });
      const fingerprintData = await response.json();

      // 然後從 Supabase 獲取對應的員工信息
      const { data: employees, error } = await supabase
        .from('employees')
        .select('*')
        .in('fingerprint_id', fingerprintData.map(f => f.id));

      if (error) throw error;

      // 合併數據
      const combinedData = fingerprintData.map(fingerprint => ({
        ...fingerprint,
        employee: employees.find(emp => emp.fingerprint_id === fingerprint.id)
      }));

      setFingerprints(combinedData);
    } catch (error) {
      setMessage('獲取指紋列表失敗');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 刪除指紋
  const deleteFingerprint = async (id) => {
    try {
      setIsLoading(true);
      const response = await fetch(`http://192.168.43.112/api/fingerprints/delete?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (response.ok) {
        setMessage('指紋刪除成功');
        fetchFingerprints();
      }
    } catch (error) {
      setMessage('刪除指紋失敗');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 處理表單輸入
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEmployeeData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 註冊新指紋和員工信息
  const registerFingerprint = async () => {
    try {
      setIsLoading(true);
      
      // 驗證必填字段
      if (!employeeData.name) {
        setMessage('請填寫姓名');
        return;
      }

      // 自動生成員工編號
      const employee_id = generateEmployeeId();

      // 註冊指紋
      const response = await fetch(`${process.env.NEXT_PUBLIC_ESP32_URL}/api/fingerprints/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        // 保存員工信息到 Supabase
        const { error } = await supabase
          .from('employees')
          .insert([{
            ...employeeData,
            employee_id,  // 使用自動生成的編號
            fingerprint_id: data.id,
            salary: employeeData.salary ? parseFloat(employeeData.salary) : 0,  // 確保工資是數字
          }]);

        if (error) throw error;

        setMessage('員工信息和指紋註冊成功！');
        setShowForm(false);
        setEmployeeData({
          name: '',
          department: '',
          position: '',
          salary: '',
        });
        fetchFingerprints();
      } else {
        setMessage(data.error || '指紋註冊失敗');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('註冊失敗');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFingerprints();
  }, []);

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">指紋管理系統</h1>
      
      {/* 消息提示 */}
      {message && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4">
          {message}
        </div>
      )}

      {/* 註冊按鈕和表單 */}
      <div className="mb-8">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            註冊新員工
          </button>
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">註冊新員工</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">姓名 *</label>
                <input
                  type="text"
                  name="name"
                  value={employeeData.name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">部門</label>
                <input
                  type="text"
                  name="department"
                  value={employeeData.department}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">職位</label>
                <input
                  type="text"
                  name="position"
                  value={employeeData.position}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">工資</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">$</span>
                  </div>
                  <input
                    type="number"
                    name="salary"
                    step="0.01"
                    min="0"
                    value={employeeData.salary}
                    onChange={handleInputChange}
                    className="mt-1 block w-full pl-7 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={registerFingerprint}
                  disabled={isLoading}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {isLoading ? '處理中...' : '註冊指紋'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* 已註冊員工列表 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">已註冊員工列表</h2>
        {isLoading ? (
          <p>加載中...</p>
        ) : fingerprints.length > 0 ? (
          <ul className="space-y-2">
            {fingerprints.map((fingerprint) => (
              <li
                key={fingerprint.id}
                className="flex justify-between items-center border-b pb-2"
              >
                <div className="flex-1">
                  {fingerprint.employee ? (
                    <>
                      <span className="font-medium">{fingerprint.employee.name}</span>
                      <span className="mx-2">|</span>
                      <span className="text-gray-600">{fingerprint.employee.position}</span>
                      {fingerprint.employee.department && (
                        <>
                          <span className="mx-2">|</span>
                          <span className="text-gray-600">{fingerprint.employee.department}</span>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-500">未關聯員工信息</span>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">ID: {fingerprint.id}</span>
                  <button
                    onClick={() => deleteFingerprint(fingerprint.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>暫無註冊員工</p>
        )}
      </div>
    </main>
  );
} 