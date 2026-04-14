import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { packageService } from "../services/customerService";
import PackageModal from "../components/PackageModal";

const Packages = () => {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("gym_user") || "{}");
    setIsAdmin(user.role === "admin");
    const fetchPackages = async () => {
      try {
        const data = await packageService.getAll();
        setList(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Lỗi tải gói tập:", error);
        setList([]);
      }
    };
    fetchPackages();
  }, []);

  const save = async (d) => {
    try {
      await packageService.save(d);
      const data = await packageService.getAll();
      setList(Array.isArray(data) ? data : []);
      setModal(false);
    } catch (error) {
      console.error("Lỗi lưu gói tập:", error);
      // Global error handled by api.js
    }
  };

  const del = async (id) => {
    if (window.confirm("Xóa gói tập này?")) {
      try {
        await packageService.delete(id);
        const data = await packageService.getAll();
        setList(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Lỗi xóa gói tập:", error);
        // Global error handled by api.js
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-text-light dark:text-text-dark text-3xl font-bold">
            Quản lý Gói tập
          </h1>
        </div>
      </div>

      <div className="flex justify-between items-center p-4 bg-surface-light dark:bg-surface-dark rounded-lg border border-border-light dark:border-border-dark">
        <div className="relative w-full max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-muted-light dark:text-text-muted-dark">
            search
          </span>
          <input
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm focus:ring-primary focus:border-primary"
            placeholder="Tìm kiếm gói..."
          />
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEdit(null);
              setModal(true);
            }}
            className="flex items-center gap-2 h-10 px-4 bg-primary text-text-light rounded-lg font-bold hover:opacity-90"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              add_circle
            </span>
            <span>Thêm gói</span>
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-background-light dark:bg-background-dark text-sm font-medium text-text-light dark:text-text-dark">
            <tr>
              <th className="px-6 py-4">Tên gói</th>
              <th className="px-6 py-4">Loại gói</th>
              <th className="px-6 py-4">Giá (VNĐ)</th>
              <th className="px-6 py-4">Thời hạn</th>
              {isAdmin && <th className="px-6 py-4 text-center">Hành động</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark">
            {list.length > 0 ? (
              list.map((p) => (
                <tr
                  key={p._id || p.id}
                  className="hover:bg-primary/10 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-text-light dark:text-text-dark">
                    {p.name || "N/A"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${p.type === 'session' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {p.type === 'session' ? 'Theo buổi' : 'Theo tháng'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-subtle-light dark:text-subtle-dark">
                    {p.price ? p.price.toLocaleString() : "0"}
                  </td>
                  <td className="px-6 py-4 font-medium text-subtle-light dark:text-subtle-dark">
                    {p.duration || 0} ngày
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => {
                          setEdit(p);
                          setModal(true);
                        }}
                        className="p-2 hover:bg-primary/20 rounded-full transition-colors"
                      >
                        <span className="material-symbols-outlined text-text-light dark:text-text-dark text-base">
                          edit
                        </span>
                      </button>
                      <button
                        onClick={() => del(p._id || p.id)}
                        className="p-2 hover:bg-red-500/20 rounded-full transition-colors"
                      >
                        <span className="material-symbols-outlined text-negative-light dark:text-negative-dark text-base">
                          delete
                        </span>
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                  Chưa có gói tập nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {modal && (
        <PackageModal
          pkg={edit}
          onSave={save}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
};
export default Packages;
