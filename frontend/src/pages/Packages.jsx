import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Search, Plus, Pencil, Trash2, Package } from "lucide-react";
import { packageService } from "../services/customerService";
import PackageModal from "../components/package/PackageModal";
import { useConfirm } from "../context/ConfirmContext";
import PageHeader from "../components/common/PageHeader";

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
    <div className="flex flex-col gap-5 font-display">
      <PageHeader
        meta="Sản phẩm dịch vụ"
        title="Gói tập"
        description="Cấu hình loại gói, thời hạn sử dụng, số buổi và giá bán niêm yết."
        icon={Package}
        actions={isAdmin ? (
          <button
            onClick={() => {
              setEdit(null);
              setModal(true);
            }}
            className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-text-light transition-colors hover:bg-primary-hover md:text-sm"
          >
            <Plus size={18} />
            <span>Thêm gói tập</span>
          </button>
        ) : null}
      />

      {/* Search Bar */}
      <div className="flex items-center gap-3 rounded-lg border border-border-light bg-surface-light p-3 dark:border-border-dark dark:bg-surface-dark">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            id="pkgSearchInput"
            name="pkgSearch"
            type="text"
            aria-label="Tìm kiếm gói tập theo tên"
            className="h-10 w-full rounded-lg border border-border-light bg-background-light pl-10 pr-4 text-sm text-text-light transition-colors placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-border-dark dark:bg-background-dark dark:text-text-dark"
            placeholder="Tìm tên gói tập..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border-light bg-surface-light dark:border-border-dark dark:bg-surface-dark">
        <table className="w-full text-left">
          <thead className="border-b border-border-light bg-background-light text-xs font-medium text-text-muted-light dark:border-border-dark dark:bg-background-dark dark:text-text-muted-dark">
            <tr>
              <th className="px-6 py-3">Tên gói</th>
              <th className="px-6 py-3">Phân loại</th>
              <th className="px-6 py-3">Giá niêm yết</th>
              <th className="px-6 py-3">Thời hạn</th>
              {isAdmin && <th className="px-6 py-3 text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:border-border-dark">
            {filteredList.length > 0 ? (
              filteredList.map((p) => (
                <tr
                  key={p._id || p.id}
                  className="transition-colors hover:bg-background-light/70 dark:hover:bg-background-dark/70"
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
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setEdit(p);
                          setModal(true);
                        }}
                        className="rounded-lg p-2 transition-colors hover:bg-primary/15"
                      >
                        <Pencil size={16} className="text-text-light dark:text-text-dark" />
                      </button>
                      <button
                        onClick={() => del(p._id || p.id)}
                        className="rounded-lg p-2 transition-colors hover:bg-red-500/15"
                      >
                        <Trash2 size={16} className="text-negative-light dark:text-negative-dark" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-6 py-8 text-center text-gray-500">
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
