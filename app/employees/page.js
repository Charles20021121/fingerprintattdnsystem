'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useAuth } from '../providers/AuthProvider';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 格式化日期的輔助函數
const formatDate = (date) => {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long'
  }).format(date);
};

// 獲取日期範圍的輔助函數
const getMonthDates = (monthString) => {
  const [year, month] = monthString.split('-').map(Number);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  return { startOfMonth, endOfMonth };
};

export default function EmployeesPage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();

  // 所有的 state hooks
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [totalStats, setTotalStats] = useState({
    totalEmployees: 0,
    totalWorkDays: 0,
    totalSalary: 0
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    department: '',
    position: '',
    salary: ''
  });

  // 所有的 useEffect hooks
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/employees/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEmployees();
    }
  }, [selectedMonth, isAuthenticated]);

  // 如果未認證，提前返回
  if (!isAuthenticated) {
    return null;
  }

  // 獲取所有員工
  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const { startOfMonth, endOfMonth } = getMonthDates(selectedMonth);

      // 獲取員工列表
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (employeesError) throw employeesError;

      // 獲取當月打卡記錄
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('*')
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString());

      if (attendanceError) throw attendanceError;

      // 修改計算邏輯
      const employeesWithStats = employeesData.map(employee => {
        const employeeAttendance = attendanceData.filter(
          record => record.employee_id === employee.id
        );

        // 按日期分組打卡記錄
        const dailyRecords = employeeAttendance.reduce((acc, record) => {
          const date = new Date(record.created_at).toLocaleDateString();
          if (!acc[date]) {
            acc[date] = [];
          }
          acc[date].push(record);
          return acc;
        }, {});

        // 計算全天和半天的工作日
        let fullDays = 0;
        let halfDays = 0;

        Object.values(dailyRecords).forEach(records => {
          const hasIn = records.some(r => r.type === 'in');
          const hasOut = records.some(r => r.type === 'out');
          if (hasIn && hasOut) {
            if (records.some(r => r.is_half_day)) {
              halfDays++;
            } else {
              fullDays++;
            }
          }
        });

        // 計算總工資（半天工資為全天的一半）
        const totalSalary = (fullDays + (halfDays * 0.5)) * (employee.salary || 0);

        return {
          ...employee,
          fullDays,
          halfDays,
          daysWorked: fullDays + (halfDays * 0.5),
          totalSalary
        };
      });

      // 計算總統計數據
      const stats = employeesWithStats.reduce((acc, employee) => {
        return {
          totalEmployees: acc.totalEmployees + 1,
          totalWorkDays: acc.totalWorkDays + (employee.daysWorked || 0),
          totalSalary: acc.totalSalary + (employee.totalSalary || 0)
        };
      }, { totalEmployees: 0, totalWorkDays: 0, totalSalary: 0 });

      setTotalStats(stats);
      setEmployees(employeesWithStats);
    } catch (error) {
      console.error('Error:', error);
      setMessage('獲取員工列表失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 編輯員工信息
  const handleEdit = (employee) => {
    setSelectedEmployee(employee);
    setShowModal(true);
  };

  // 更新員工信息
  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('employees')
        .update({
          name: selectedEmployee.name,
          department: selectedEmployee.department,
          position: selectedEmployee.position,
          salary: selectedEmployee.salary,
        })
        .eq('id', selectedEmployee.id);

      if (error) throw error;
      setMessage('員工信息更新成功');
      setShowModal(false);
      fetchEmployees();
    } catch (error) {
      console.error('Error:', error);
      setMessage('更新失敗');
    } finally {
      setIsLoading(false);
    }
  };

  // 修改刪除員工函數
  const handleDelete = async (id) => {
    if (!confirm('確定要刪除此員工嗎？此操作將同時刪除該員工的所有打卡記錄和指紋。')) return;
    
    try {
      setIsLoading(true);

      // 先獲取員工信息以取得指紋ID
      const { data: employee, error: fetchError } = await supabase
        .from('employees')
        .select('fingerprint_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // 刪除員工（打卡記錄會通過級聯刪除自動刪除）
      const { error: deleteError } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // 如果有指紋ID，則調用ESP32的刪除指紋API
      if (employee.fingerprint_id) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_ESP32_URL}/api/fingerprints/delete?id=${employee.fingerprint_id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Failed to delete fingerprint');
          setMessage('員工已刪除，但指紋刪除失敗');
          fetchEmployees();
          return;
        }
      }

      setMessage('員工和相關數據已完全刪除');
      fetchEmployees();
    } catch (error) {
      console.error('Error:', error);
      setMessage('刪除失敗: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 添加註冊指紋函數
  const handleRegisterFingerprint = async (employeeId) => {
    try {
      setIsLoading(true);
      setMessage('請將手指放在感應器上...');

      // 調用 ESP32 的指紋註冊 API
      const response = await fetch(`${process.env.NEXT_PUBLIC_ESP32_URL}/api/fingerprints/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        // 更新員工的指紋ID
        const { error } = await supabase
          .from('employees')
          .update({ fingerprint_id: data.id })
          .eq('id', employeeId);

        if (error) throw error;
        setMessage('指紋註冊成功！');
        fetchEmployees();
      } else {
        setMessage(data.error || '指紋註冊失敗');
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage('註冊失敗: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 添加創建員工函數
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);

      // 生成員工編號
      const employee_id = 'EMP' + Date.now().toString().slice(-6);

      const { error } = await supabase
        .from('employees')
        .insert([{
          ...newEmployee,
          employee_id,
          salary: parseFloat(newEmployee.salary) || 0
        }]);

      if (error) throw error;

      setMessage('員工創建成功！');
      setShowAddModal(false);
      setNewEmployee({
        name: '',
        department: '',
        position: '',
        salary: ''
      });
      fetchEmployees();
    } catch (error) {
      console.error('Error:', error);
      setMessage('創建失敗: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">員工管理</h1>
          <div className="flex items-center mt-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
            <p className="text-gray-600 ml-4">工資統計</p>
          </div>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
          >
            註冊新員工
          </button>
          <button
            onClick={logout}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
          >
            登出
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4">
          {message}
        </div>
      )}

      {/* 員工列表 */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                員工編號
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                姓名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                部門
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                職位
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                日薪
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                本月出勤
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                本月工資
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                指紋ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr key={employee.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {employee.employee_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{employee.department || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{employee.position || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">${employee.salary?.toFixed(2) || '0.00'}/天</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {employee.daysWorked.toFixed(1)} 天
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-green-600">${employee.totalSalary?.toFixed(2) || '0.00'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{employee.fingerprint_id || '未註冊'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <a
                    href={`/employees/${employee.id}`}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    查看詳情
                  </a>
                  <button
                    onClick={() => handleEdit(employee)}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    編輯
                  </button>
                  {!employee.fingerprint_id ? (
                    <button
                      onClick={() => handleRegisterFingerprint(employee.id)}
                      className="text-green-600 hover:text-green-900 mr-4"
                      disabled={isLoading}
                    >
                      註冊指紋
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(employee.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      刪除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 編統計區塊 */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">本月統計</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">總員工數</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {totalStats.totalEmployees} 人
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">總出勤天數</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {totalStats.totalWorkDays.toFixed(1)} 天
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">總工資支出</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              ${totalStats.totalSalary.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          * 統計數據基於當月（{formatDate(new Date())}）的考勤記錄
        </div>
      </div>

      {/* 編輯模態框 */}
      {showModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90%]">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">編輯員工信息</h3>
                <button
                  onClick={() => setShowModal(false)}
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
                    value={selectedEmployee.name}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, name: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">部門</label>
                  <input
                    type="text"
                    value={selectedEmployee.department || ''}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, department: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">職位</label>
                  <input
                    type="text"
                    value={selectedEmployee.position || ''}
                    onChange={(e) => setSelectedEmployee({...selectedEmployee, position: e.target.value})}
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
                      value={selectedEmployee.salary || ''}
                      onChange={(e) => setSelectedEmployee({...selectedEmployee, salary: parseFloat(e.target.value) || 0})}
                      className="mt-1 block w-full pl-7 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700">指紋狀態</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedEmployee.fingerprint_id 
                          ? `已註冊 (ID: ${selectedEmployee.fingerprint_id})` 
                          : '未註冊'}
                      </p>
                    </div>
                    {!selectedEmployee.fingerprint_id && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowModal(false);
                          handleRegisterFingerprint(selectedEmployee.id);
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                      >
                        註冊指紋
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
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

      {/* 添加新員工模態框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90%]">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">註冊新員工</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleCreateEmployee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">姓名 *</label>
                  <input
                    type="text"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">部門</label>
                  <input
                    type="text"
                    value={newEmployee.department}
                    onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">職位</label>
                  <input
                    type="text"
                    value={newEmployee.position}
                    onChange={(e) => setNewEmployee({...newEmployee, position: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">日薪</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newEmployee.salary}
                      onChange={(e) => setNewEmployee({...newEmployee, salary: e.target.value})}
                      className="mt-1 block w-full pl-7 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
                  >
                    {isLoading ? '創建中...' : '創建'}
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