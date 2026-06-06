import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { packageService } from "../services/customerService";
import PackageModal from "../components/package/PackageModal";
import { useConfirm } from "../context/ConfirmContext";

const Packages = () => {
  const [list, setList] = useState([]);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const confirm = useConfirm();

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
      toast.success("Lưu gói tập thành công!");
    } catch (error) {
      console.error("Lỗi lưu gói tập:", error);
      toast.error(error.response?.data?.message || "Lỗi khi lưu gói tập");
    }
  };

  const del = async (id) => {
    const isConfirmed = await confirm({
      title: "Xóa gói tập",
      message: "Bạn có chắc chắn muốn xóa gói tập này không? Hành động này không thể hoàn tác.",
      type: "danger"
    });
    if (isConfirmed) {
      try {
        await packageService.delete(id);
        const data = await packageService.getAll();
        setList(Array.isArray(data) ? data : []);
        toast.success("Đã xóa gói tập thành công!");
      } catch (error) {
        console.error("Lỗi xóa gói tập:", error);
        toast.error("Lỗi khi xóa gói tập");
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">

      <div className="flex items-center gap-3 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark">
        <div className="relative flex-1 max-w-2xl">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-muted-light dark:text-text-muted-dark">
            search
          </span>
          <input
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Tìm kiếm gói..."
          />
        </div>

        <div className="flex-1" />

        {isAdmin && (
          <button
            onClick={() => {
              setEdit(null);
              setModal(true);
            }}
            className="flex items-center gap-2 h-10 px-4 bg-primary text-text-light rounded-xl font-bold hover:opacity-90"
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

      <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-100 dark:bg-gray-800 uppercase text-sm font-bold text-gray-700">
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
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${p.type === 'session' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
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
                        className="p-2 hover:bg-primary/20 rounded-xl transition-colors"
                      >
                        <span className="material-symbols-outlined text-text-light dark:text-text-dark text-base">
                          edit
                        </span>
                      </button>
                      <button
                        onClick={() => del(p._id || p.id)}
                        className="p-2 hover:bg-red-500/20 rounded-xl transition-colors"
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
