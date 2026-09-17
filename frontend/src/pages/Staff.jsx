import React, { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Users, UserCog, Search } from "lucide-react";
import { staffService } from "../services/customerService";
import StaffModal from "../components/staff/StaffModal";
import StaffDetailModal from "../components/staff/StaffDetailModal";
import toast from "react-hot-toast";
import { useConfirm } from "../context/ConfirmContext";

const Staff = () => {
  const [list, setList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [detailStaff, setDetailStaff] = useState(null);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [edit, setEdit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const confirm = useConfirm();

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await staffService.getAll();
      
      // Dinh nghia do uu tien cua cac chuc vu
      const getRolePriority = (role) => {
        const r = (role || "").toLowerCase();
        if (r === "sm") return 1;
        if (r === "pm") return 2;
        if (r === "om") return 3;
        if (r === "sale") return 4;
        if (r === "pt") return 5;
        if (r === "reception") return 6;
        return 7; // Cac vai tro khac nhu manager, accountant...
      };

      // Sap xep danh sach nhan vien theo chuc vu, sau do theo ten
      const sortedData = (Array.isArray(data) ? data : []).sort((a, b) => {
        const priorityA = getRolePriority(a.role);
        const priorityB = getRolePriority(b.role);
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        const nameA = (a.fullName || a.name || "").toLowerCase();
        const nameB = (b.fullName || b.name || "").toLowerCase();
        return nameA.localeCompare(nameB, "vi");
      });

      setList(sortedData);

      // Lấy lịch làm việc của hôm nay
      const today = new Date().toLocaleDateString("en-CA");
      const schedulesData = await staffService.getSchedules({ date: today });
      setTodaySchedules(schedulesData);
    } catch (error) {
      console.error("Lỗi tải nhân viên:", error);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("gym_user") || "{}");
    setIsAdmin(user.role === "admin" || user.role === "accountant");
    fetchStaff();
  }, []);

  const save = async (d) => {
    try {
      await staffService.save(d);
      await fetchStaff();
      setModal(false);
      toast.success("Lưu thông tin nhân viên thành công!");
    } catch (error) {
      console.error("Lỗi lưu nhân viên:", error);
      toast.error(error.response?.data?.message || "Lỗi khi lưu nhân viên");
    }
  };

  const del = async (id) => {
    const isConfirmed = await confirm({
      title: "Xóa nhân viên",
      message: "Bạn có chắc chắn muốn xóa nhân viên này khỏi hệ thống?",
      type: "danger"
    });
    if (isConfirmed) {
      try {
        await staffService.delete(id);
        await fetchStaff();
        toast.success("Đã xóa nhân viên thành công!");
      } catch (error) {
        toast.error("Không thể xóa nhân viên");
      }
    }
  };

  // Hàm hiển thị ngày sinh
  const formatDob = (dob) => {
    if (!dob) return "--/--/----";
    try {
      const date = new Date(dob);
      if (isNaN(date.getTime())) return "--/--/----";
      // Format ngày VN: dd/mm/yyyy
      return date.toLocaleDateString("vi-VN");
    } catch (e) {
      return "--/--/----";
    }
  };

  const filteredList = list.filter((s) => {
    const name = (s.fullName || s.name || "").toLowerCase();
    const username = (s.username || "").toLowerCase();
    const phone = (s.phone || "").toLowerCase();
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      name.includes(q) ||
      username.includes(q) ||
      phone.includes(q);

    const matchesRole = roleFilter === "all" || s.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex flex-col gap-6 font-display">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2.5 text-text-light dark:text-text-dark">
            <UserCog size={24} className="text-primary" /> Quản lý đội ngũ nhân sự
          </h2>
          <p className="text-subtle-light dark:text-subtle-dark text-sm mt-1">
            Phân quyền tài khoản, quản lý huấn luyện viên (PT), tư vấn viên (Sale) và lễ tân
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEdit(null); setModal(true); }}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-text-light text-xs md:text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
          >
            <Plus size={18} />
            Thêm nhân viên
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center gap-3 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={18} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, username, số điện thoại..."
            className="w-full pl-10 pr-4 h-10 border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-gray-400 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-52">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-gray-700 dark:text-gray-300"
          >
            <option value="all">Tất cả chức vụ</option>
            <option value="admin">Quản trị viên (Admin)</option>
            <option value="manager">Quản lý (Manager)</option>
            <option value="sm">Trưởng nhóm Sale (SM)</option>
            <option value="pm">Trưởng nhóm PT (PM)</option>
            <option value="om">Quản lý vận hành (OM)</option>
            <option value="pt">Huấn luyện viên (PT)</option>
            <option value="sale">Tư vấn viên (Sale)</option>
            <option value="accountant">Kế toán (Accountant)</option>
            <option value="reception">Lễ tân (Reception)</option>
          </select>
        </div>
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark text-xs uppercase font-bold tracking-wider border-b border-border-light dark:border-border-dark">
              <tr>
                <th className="px-6 py-4">HỌ TÊN</th>
                <th className="px-6 py-4">CHỨC VỤ</th>
                <th className="px-6 py-4 text-center">SỐ KH PHỤ TRÁCH</th>
                <th className="px-6 py-4 text-center">LỊCH LÀM VIỆC</th>
                {isAdmin && <th className="px-6 py-4 text-right">HÀNH ĐỘNG</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filteredList.length > 0 ? (
                filteredList.map((s) => {
                  const shiftData = todaySchedules.find(sch => sch.staff && (sch.staff._id === (s._id || s.id) || sch.staff === (s._id || s.id)));
                  const shift = shiftData ? shiftData.shiftType : "Nghỉ";
                  
                  return (
                  <tr
                    key={s._id || s.id}
                    className="hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors cursor-pointer"
                    onClick={() => setDetailStaff(s)}
                  >
                    <td className="px-6 py-4 font-medium text-text-light dark:text-text-dark text-blue-600 hover:underline">
                      {s.fullName || s.name || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          s.role === "manager"
                            ? "bg-purple-100 text-purple-700"
                            : s.role === "sale"
                            ? "bg-orange-100 text-orange-700"
                            : s.role === "pt"
                            ? "bg-blue-100 text-blue-700"
                            : s.role === "reception"
                            ? "bg-green-100 text-green-700"
                            : ["sm", "pm", "om"].includes(s.role)
                            ? "bg-pink-100 text-pink-700"
                            : s.role === "accountant"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {s.role === "manager"
                          ? "Quản lý"
                          : s.role === "sale"
                          ? "Sale"
                          : s.role === "pt"
                          ? "PT"
                          : s.role === "reception"
                          ? "Lễ tân"
                          : s.role === "accountant"
                          ? "Kế toán"
                          : s.role === "sm"
                          ? "SM"
                          : s.role === "pm"
                          ? "PM"
                          : s.role === "om"
                          ? "OM"
                          : s.role || "N/A"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center text-text-light dark:text-text-dark font-bold text-blue-600">
                      {s.activeCustomersCount || 0} <span className="text-gray-500 font-normal text-xs ml-1">khách</span>
                    </td>

                    {/* Cột Ca Hôm Nay */}
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                          shift === "Nghỉ"
                            ? "bg-gray-100 text-gray-500 border-transparent"
                            : shift === "Sáng"
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : shift === "Chiều"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-green-50 text-green-700 border-green-200"
                        }`}
                      >
                        {shift}
                      </span>
                    </td>

                    {isAdmin && (
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEdit(s);
                              setModal(true);
                            }}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-full transition-colors"
                            title="Sửa"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => del(s._id || s.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  );
                })

              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Users size={36} className="text-gray-300" />
                      <p>Chưa có nhân viên nào.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <StaffModal
          staff={edit}
          onSave={save}
          onClose={() => setModal(false)}
        />
      )}
      {detailStaff && (
        <StaffDetailModal
          staff={detailStaff}
          isAdmin={
            (() => {
              const currentUser = JSON.parse(localStorage.getItem("gym_user") || "{}");
              const isSelf = currentUser._id === (detailStaff?._id || detailStaff?.id);
              return (
                isSelf ||
                currentUser.role === "admin" ||
                currentUser.role === "accountant" ||
                (currentUser.role === "sm" && (detailStaff?.role === "sale" || detailStaff?.role === "sm")) ||
                (currentUser.role === "pm" && (detailStaff?.role === "pt" || detailStaff?.role === "pm")) ||
                (currentUser.role === "om" && (detailStaff?.role === "reception" || detailStaff?.role === "om"))
              );
            })()
          }
          onClose={() => setDetailStaff(null)}
          onScheduleUpdate={async () => {
            const today = new Date().toLocaleDateString("en-CA");
            const schedulesData = await staffService.getSchedules({ date: today });
            setTodaySchedules(schedulesData);
          }}
        />
      )}
    </div>
  );
};
export default Staff;
