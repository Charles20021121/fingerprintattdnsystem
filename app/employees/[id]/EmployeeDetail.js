'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 格式化日期的輔助函數
const formatDate = (date) => {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(date));
};

const formatTime = (date) => {
  return new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(date));
};

export default function EmployeeDetail({ id }) {
  const router = useRouter();
  const [employee, setEmployee] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    type: 'in',
    is_half_day: false
  });
  const [editingRecord, setEditingRecord] = useState(null);
  const [showEditRecordModal, setShowEditRecordModal] = useState(false);

  // 獲取員工信息和打卡記錄
  const fetchEmployeeData = async () => {
    try {
      setIsLoading(true);
      // 獲取員工信息
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      if (employeeError) throw employeeError;
      setEmployee(employeeData);
      setEditingEmployee(employeeData);

      // 根據選擇的月份獲取日期範圍
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // 獲取打卡記錄
      const { data: records, error: recordsError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('employee_id', id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (recordsError) throw recordsError;
      
      // 按日期分組打卡記錄
      const groupedRecords = records.reduce((acc, record) => {
        const date = new Date(record.created_at).toLocaleDateString();
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(record);
        return acc;
      }, {});

      setAttendanceRecords(groupedRecords);
    } catch (error) {
      console.error('Error:', error);
      setMessage('獲取數據失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 更新員工信息
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('employees')
        .update({
          name: editingEmployee.name,
          department: editingEmployee.department,
          position: editingEmployee.position,
          salary: editingEmployee.salary,
        })
        .eq('id', employee.id);

      if (error) throw error;
      setMessage('員工信息更新成功');
      setShowEditModal(false);
      fetchEmployeeData();
    } catch (error) {
      console.error('Error:', error);
      setMessage('更新失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 刪除打卡記錄
  const handleDeleteRecord = async (recordId) => {
    if (!confirm('確定要刪除此打卡記錄嗎？')) return;
    
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('attendance_records')
        .delete()
        .eq('id', recordId);

      if (error) throw error;
      setMessage('打卡記錄已刪除');
      fetchEmployeeData();
    } catch (error) {
      console.error('Error:', error);
      setMessage('刪除失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 添加手動打卡的函數
  const handleAddRecord = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      
      // 組合日期和時間
      const dateTime = new Date(`${newRecord.date}T${newRecord.time}`);

      const { error } = await supabase
        .from('attendance_records')
        .insert([{
          employee_id: employee.id,
          type: newRecord.type,
          status: 'present',
          is_half_day: newRecord.is_half_day,
          created_at: dateTime.toISOString()
        }]);

      if (error) throw error;
      setMessage('打卡記錄添加成功');
      setShowAddRecordModal(false);
      fetchEmployeeData();
    } catch (error) {
      console.error('Error:', error);
      setMessage('添加打卡記錄失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 添加編輯打卡記錄的功能
  const handleEditRecord = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('attendance_records')
        .update({
          type: editingRecord.type,
          is_half_day: editingRecord.is_half_day
        })
        .eq('id', editingRecord.id);

      if (error) throw error;
      setMessage('打卡記錄更新成功');
      setShowEditRecordModal(false);
      fetchEmployeeData();
    } catch (error) {
      console.error('Error:', error);
      setMessage('更新失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 修改 editingRecord 的初始化方式
  const initEditingRecord = (record) => {
    setEditingRecord({
      id: record.id,
      type: record.type || 'in',
      is_half_day: record.is_half_day || false,
      created_at: record.created_at
    });
  };

  useEffect(() => {
    fetchEmployeeData();
  }, [id]);

  // 當月份改變時重新獲取數據
  useEffect(() => {
    if (employee) {
      fetchEmployeeData();
    }
  }, [selectedMonth]);

  if (!employee) return <div>加載中...</div>;

  return (
    <main className="p-4 max-w-4xl mx-auto">
      {/* 返回按鈕 */}
      <button
        onClick={() => router.back()}
        className="mb-4 text-gray-600 hover:text-gray-900 flex items-center"
      >
        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        返回
      </button>

      {message && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4">
          {message}
        </div>
      )}

      {/* 員工基本信息 */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">{employee.name}</h1>
            <p className="text-gray-600">員工編號：{employee.employee_id}</p>
            <p className="text-gray-600">部門：{employee.department || '未設置'}</p>
            <p className="text-gray-600">職位：{employee.position || '未設置'}</p>
            <p className="text-gray-600">指紋ID：{employee.fingerprint_id || '未註冊'}</p>
            <p className="text-gray-600">工資：${employee.salary?.toFixed(2) || '0.00'}</p>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
          >
            編輯信息
          </button>
        </div>
      </div>

      {/* 打卡記錄 */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">打卡記錄</h2>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowAddRecordModal(true)}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            添加打卡記錄
          </button>
        </div>
        {Object.entries(attendanceRecords).map(([date, records]) => (
          <div key={date} className="mb-6">
            <h3 className="text-lg font-medium mb-3">{formatDate(date)}</h3>
            <div className="space-y-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex justify-between items-center border-b pb-2"
                >
                  <div>
                    <span className={`font-medium ${
                      record.type === 'in' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {record.type === 'in' ? '上班' : '下班'}
                    </span>
                    <span className="ml-4 text-gray-600">
                      {formatTime(record.created_at)}
                    </span>
                    <span className={`ml-4 ${
                      record.is_half_day ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {record.is_half_day ? '半天' : '全天'}
                    </span>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => {
                        initEditingRecord(record);
                        setShowEditRecordModal(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => handleDeleteRecord(record.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(attendanceRecords).length === 0 && (
          <p className="text-gray-500">暫無打卡記錄</p>
        )}
      </div>

      {/* 編輯模態框 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90%]">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">編輯員工信息</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">姓名</label>
                  <input
                    type="text"
                    value={editingEmployee.name}
                    onChange={(e) => setEditingEmployee({...editingEmployee, name: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">部門</label>
                  <input
                    type="text"
                    value={editingEmployee.department || ''}
                    onChange={(e) => setEditingEmployee({...editingEmployee, department: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">職位</label>
                  <input
                    type="text"
                    value={editingEmployee.position || ''}
                    onChange={(e) => setEditingEmployee({...editingEmployee, position: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
                      step="0.01"
                      min="0"
                      value={editingEmployee.salary || ''}
                      onChange={(e) => setEditingEmployee({...editingEmployee, salary: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full pl-7 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
                  >
                    {isLoading ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 添加打卡記錄模態框 */}
      {showAddRecordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90%]">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">添加打卡記錄</h3>
                <button
                  onClick={() => setShowAddRecordModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleAddRecord} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">日期</label>
                  <input
                    type="date"
                    value={newRecord.date}
                    onChange={(e) => setNewRecord({...newRecord, date: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">時間</label>
                  <input
                    type="time"
                    value={newRecord.time}
                    onChange={(e) => setNewRecord({...newRecord, time: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">類型</label>
                  <select
                    value={newRecord.type}
                    onChange={(e) => setNewRecord({...newRecord, type: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="in">上班</option>
                    <option value="out">下班</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">出勤類型</label>
                  <div className="mt-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={newRecord.is_half_day}
                        onChange={(e) => setNewRecord({...newRecord, is_half_day: e.target.checked})}
                        className="form-checkbox h-5 w-5 text-indigo-600"
                      />
                      <span className="ml-2 text-gray-700">半天</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddRecordModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
                  >
                    {isLoading ? '添加中...' : '添加'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 月度統計信息 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">本月出勤統計</p>
            <div className="text-xl font-semibold space-y-1">
              <p>全天: {
                Object.values(attendanceRecords).filter(records => {
                  const hasIn = records.some(r => r.type === 'in');
                  const hasOut = records.some(r => r.type === 'out');
                  return hasIn && hasOut && !records.some(r => r.is_half_day);
                }).length
              } 天</p>
              <p>半天: {
                Object.values(attendanceRecords).filter(records => {
                  const hasIn = records.some(r => r.type === 'in');
                  const hasOut = records.some(r => r.type === 'out');
                  return hasIn && hasOut && records.some(r => r.is_half_day);
                }).length
              } 天</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">本月工資</p>
            <p className="text-xl font-semibold text-green-600">
              ${(() => {
                const fullDays = Object.values(attendanceRecords).filter(records => {
                  const hasIn = records.some(r => r.type === 'in');
                  const hasOut = records.some(r => r.type === 'out');
                  return hasIn && hasOut && !records.some(r => r.is_half_day);
                }).length;

                const halfDays = Object.values(attendanceRecords).filter(records => {
                  const hasIn = records.some(r => r.type === 'in');
                  const hasOut = records.some(r => r.type === 'out');
                  return hasIn && hasOut && records.some(r => r.is_half_day);
                }).length;

                return ((fullDays + (halfDays * 0.5)) * (employee.salary || 0)).toFixed(2);
              })()}
            </p>
          </div>
        </div>
      </div>

      {/* 編輯打卡記錄模態框 */}
      {showEditRecordModal && editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90%]">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">編輯打卡記錄</h3>
                <button
                  onClick={() => setShowEditRecordModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleEditRecord} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">類型</label>
                  <select
                    value={editingRecord.type || 'in'}
                    onChange={(e) => setEditingRecord({...editingRecord, type: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="in">上班</option>
                    <option value="out">下班</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">出勤類型</label>
                  <div className="mt-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={editingRecord.is_half_day || false}
                        onChange={(e) => setEditingRecord({...editingRecord, is_half_day: e.target.checked})}
                        className="form-checkbox h-5 w-5 text-indigo-600"
                      />
                      <span className="ml-2 text-gray-700">半天</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditRecordModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
                  >
                    {isLoading ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 