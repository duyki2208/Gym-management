import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Search, Plus, Pencil, Trash2, Package } from "lucide-react";
import { packageService } from "../services/customerService";
import PackageModal from "../components/package/PackageModal";
import { useConfirm } from "../context/ConfirmContext";
import { getIconColor } from "../utils/iconTone";

const Packages = () => {
  const [list, setList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredList = list.filter((p) =>
    (p.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 font-display">
      {/* Page header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-light dark:bg-surface-dark p-5 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight flex items-center gap-2.5 text-text-light dark:text-text-dark">
            <Package size={24} className={getIconColor(Package)} /> Quản lý gói tập
          </h2>
          <p className="text-subtle-light dark:text-subtle-dark text-sm mt-1">
            Cấu hình danh mục gói hội viên, thời hạn sử dụng, phân loại và giá bán niêm yết
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEdit(null);
              setModal(true);
            }}
            className="flex items-center gap-2 h-10 px-4 bg-primary text-text-light rounded-xl text-xs md:text-sm font-semibold hover:bg-primary/90 shrink-0 shadow-sm transition-all cursor-pointer"
          >
            <Plus size={18} />
            <span>Thêm gói tập</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 p-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            id="pkgSearchInput"
            name="pkgSearch"
            type="text"
            aria-label="Tìm kiếm gói tập theo tên"
            className="w-full pl-10 pr-4 h-10 border border-border-light dark:border-border-dark rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary text-sm bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark placeholder:text-gray-400 transition-colors"
            placeholder="Tìm tên gói tập..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-background-light dark:bg-background-dark uppercase text-sm font-bold text-text-light dark:text-text-dark border-b border-border-light dark:border-border-dark">
            <tr>
              <th className="px-6 py-4">TÊN GÓI</th>
              <th className="px-6 py-4">LOẠI GÓI</th>
              <th className="px-6 py-4">GIÁ (VNĐ)</th>
              <th className="px-6 py-4">THỜI HẠN</th>
              {isAdmin && <th className="px-6 py-4 text-center">HÀNH ĐỘNG</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:border-border-dark">
            {filteredList.length > 0 ? (
              filteredList.map((p) => (
                <tr
                  key={p._id || p.id}
                  className="hover:bg-primary/10 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-text-light dark:text-text-dark">
                    {p.name || "N/A"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.type === 'session' ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'}`}>
                          {p.type === 'session' ? 'Theo buổi' : 'Theo tháng'}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.category === 'trial' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'}`}>
                          {p.category === 'trial' ? 'Trải nghiệm' : 'Duy trì'}
                      </span>
                    </div>
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
                        <Pencil size={16} className="text-text-light dark:text-text-dark" />
                      </button>
                      <button
                        onClick={() => del(p._id || p.id)}
                        className="p-2 hover:bg-red-500/20 rounded-xl transition-colors"
                      >
                        <Trash2 size={16} className="text-negative-light dark:text-negative-dark" />
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
