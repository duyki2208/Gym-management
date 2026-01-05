import React, { useState, useEffect } from "react";
import { staffService } from "../services/customerService";
import StaffModal from "../components/StaffModal";

const Staff = () => {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const data = await staffService.getAll();

      setList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Lỗi tải nhân viên:", error);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("gym_user") || "{}");
    setIsAdmin(user.role === "admin");
    fetchStaff();
  }, []);

  const save = async (d) => {
    try {
      await staffService.save(d);
      await fetchStaff();
      setModal(false);
    } catch (error) {
      console.error("Lỗi lưu nhân viên:", error);
      alert("Có lỗi xảy ra khi lưu nhân viên.");
    }
  };

  const del = async (id) => {
    if (window.confirm("Xóa nhân viên này?")) {
      try {
        await staffService.delete(id);
        await fetchStaff();
      } catch (error) {
        alert("Có lỗi xảy ra khi xóa nhân viên.");
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

  return (
    <div className="flex flex-col gap-6 font-display">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark">
            Quản lý Nhân viên
          </h1>
          <p className="text-subtle-light dark:text-subtle-dark text-sm mt-1">
            Danh sách nhân sự và phân quyền.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEdit(null);
              setModal(true);
            }}
            className="flex items-center gap-2 h-11 px-5 rounded-lg bg-primary text-text-light font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined font-bold">add</span>{" "}
            Thêm mới
          </button>
        )}
      </header>

      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-background-light dark:bg-background-dark text-text-muted-light dark:text-text-muted-dark text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Họ tên</th>
                <th className="px-6 py-4">Chức vụ</th>
                <th className="px-6 py-4">Ngày sinh</th>
                <th className="px-6 py-4">SĐT</th>
                {isAdmin && <th className="px-6 py-4 text-right">Hành động</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : list.length > 0 ? (
                list.map((s) => (
                  <tr
                    key={s._id || s.id}
                    className="hover:bg-background-light dark:hover:bg-background-dark/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-text-light dark:text-text-dark">
                      {s.fullName || s.name || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          s.role === "manager"
                            ? "bg-purple-100 text-purple-700"
                            : s.role === "sale"
                            ? "bg-orange-100 text-orange-700"
                            : s.role === "pt"
                            ? "bg-blue-100 text-blue-700"
                            : s.role === "reception"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {s.role === "manager"
                          ? "Quản lý"
                          : s.role === "sale"
                          ? "Sale"
                          : s.role === "pt"
                          ? "PT (HLV)"
                          : s.role === "reception"
                          ? "Lễ tân"
                          : s.role || "N/A"}
                      </span>
                      {s.specialty && (
                        <div className="text-xs mt-1 text-gray-500 italic">
                          {s.specialty}
                        </div>
                      )}
                    </td>

                    {/* Cột Ngày Sinh */}
                    <td className="px-6 py-4 text-text-light dark:text-text-dark text-sm font-medium">
                      {formatDob(s.dob)}
                    </td>

                    <td className="px-6 py-4 text-text-light dark:text-text-dark font-mono text-sm">
                      {s.phone || "N/A"}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEdit(s);
                              setModal(true);
                            }}
                            className="p-2 hover:bg-blue-50 text-blue-600 rounded-full transition-colors"
                            title="Sửa"
                          >
                            <span className="material-symbols-outlined text-xl">
                              edit
                            </span>
                          </button>
                          <button
                            onClick={() => del(s._id || s.id)}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors"
                            title="Xóa"
                          >
                            <span className="material-symbols-outlined text-xl">
                              delete
                            </span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))

              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-4xl text-gray-300">
                        group_off
                      </span>
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
    </div>
  );
};
export default Staff;
