import React, { useState, useEffect } from "react";
import { staffService } from "../services/customerService";
import StaffModal from "../components/StaffModal";

const Staff = () => {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const data = await staffService.getAll();
        setList(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Lỗi tải nhân viên:", error);
        setList([]);
      }
    };
    fetchStaff();
  }, []);

  const save = async (d) => {
    try {
      await staffService.save(d);
      const data = await staffService.getAll();
      setList(Array.isArray(data) ? data : []);
      setModal(false);
    } catch (error) {
      console.error("Lỗi lưu nhân viên:", error);
      alert("Có lỗi xảy ra khi lưu nhân viên. Vui lòng thử lại.");
    }
  };

  const del = async (id) => {
    if (window.confirm("Xóa nhân viên này?")) {
      try {
        await staffService.delete(id);
        const data = await staffService.getAll();
        setList(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Lỗi xóa nhân viên:", error);
        alert("Có lỗi xảy ra khi xóa nhân viên. Vui lòng thử lại.");
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark">
            Quản lý Nhân viên
          </h1>
          <p className="text-subtle-light dark:text-subtle-dark"></p>
        </div>
        <button
          onClick={() => {
            setEdit(null);
            setModal(true);
          }}
          className="flex items-center gap-2 h-11 px-5 rounded-lg bg-primary text-text-light font-bold hover:opacity-90"
        >
          <span className="material-symbols-outlined">add</span> Thêm
        </button>
      </header>

      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-background-light dark:bg-background-dark text-text-muted-light dark:text-text-muted-dark text-sm uppercase">
              <tr>
                <th className="px-6 py-4">Tên</th>
                <th className="px-6 py-4">Vai trò</th>
                <th className="px-6 py-4">SĐT</th>
                <th className="px-6 py-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {list.length > 0 ? (
                list.map((s) => (
                  <tr
                    key={s._id || s.id}
                    className="hover:bg-background-light dark:hover:bg-background-dark/50"
                  >
                    <td className="px-6 py-4 font-semibold text-text-light dark:text-text-dark">
                      {s.name || "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary-subtle-light dark:bg-primary-subtle-dark text-text-light dark:text-text-dark">
                        {s.role || "N/A"}
                      </span>
                      {s.specialty && (
                        <div className="text-xs mt-1 text-text-muted-light dark:text-text-muted-dark">
                          {s.specialty}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-light dark:text-text-dark">
                      {s.phone || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setEdit(s);
                          setModal(true);
                        }}
                        className="p-2 hover:bg-primary/10 rounded-full"
                      >
                        <span className="material-symbols-outlined text-xl text-text-muted-light dark:text-text-muted-dark">
                          edit
                        </span>
                      </button>
                      <button
                        onClick={() => del(s._id || s.id)}
                        className="p-2 hover:bg-red-500/10 rounded-full"
                      >
                        <span className="material-symbols-outlined text-xl text-negative-light dark:text-negative-dark">
                          delete
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="4"
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    Chưa có nhân viên nào.
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
