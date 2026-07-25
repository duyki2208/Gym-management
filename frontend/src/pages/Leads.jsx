import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../services/api";
import {
  Users,
  Search,
  Plus,
  UserCheck,
  Phone,
  Mail,
  FileText,
  Calendar,
  Trash2,
  Edit3,
  ChevronRight,
  TrendingUp,
  MessageSquare,
} from "lucide-react";

const Leads = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sales, setSales] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const [selectedLead, setSelectedLead] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    source: "facebook",
    assignedSale: "",
    note: "",
  });

  const [newNote, setNewNote] = useState("");

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;

      const response = await api.get("/leads", { params });
      if (response.data.success) {
        setLeads(response.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách khách hàng tiềm năng");
    } finally {
      setLoading(false);
    }
  };

  const fetchSales = async () => {
    try {
      const response = await api.get("/staff");
      if (Array.isArray(response.data)) {
        setSales(response.data.filter((s) => ["sale", "sm", "pm", "manager"].includes(s.role)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [search, statusFilter, sourceFilter]);

  useEffect(() => {
    fetchSales();
  }, []);

  const handleCreateLead = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/leads", formData);
      if (response.data.success) {
        toast.success(response.data.message);
        setShowAddModal(false);
        setFormData({ name: "", phone: "", email: "", source: "facebook", assignedSale: "", note: "" });
        fetchLeads();
      } else {
        toast.error(response.data.message);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi khi thêm khách hàng tiềm năng");
    }
  };

  const handleUpdateLead = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put(`/leads/${selectedLead._id}`, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        source: formData.source,
        status: formData.status,
        assignedSale: formData.assignedSale || null,
      });
      if (response.data.success) {
        toast.success(response.data.message);
        setShowEditModal(false);
        fetchLeads();
      } else {
        toast.error(response.data.message);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi khi cập nhật");
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
      const response = await api.put(`/leads/${selectedLead._id}`, { note: newNote });
      if (response.data.success) {
        toast.success("Thêm ghi chú chăm sóc thành công");
        setSelectedLead(response.data.data);
        setNewNote("");
        fetchLeads();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi thêm ghi chú");
    }
  };

  const handleConvertLead = async (lead) => {
    try {
      const response = await api.post(`/leads/${lead._id}/convert`);
      if (response.data.success) {
        toast.success("Đã chuyển đổi thành công! Chuyển hướng tới trang đăng ký.");
        
        // Redirect to /customers with prefilled query string
        const params = new URLSearchParams({
          convertName: response.data.data.name,
          convertPhone: response.data.data.phone,
          convertEmail: response.data.data.email,
          convertSource: response.data.data.source,
          convertStaff: response.data.data.assignedStaff || "",
        });
        navigate(`/customers?${params.toString()}`);
      } else {
        toast.error(response.data.message);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi chuyển đổi hội viên");
    }
  };

  const handleDeleteLead = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa khách hàng tiềm năng này?")) return;
    try {
      const response = await api.delete(`/leads/${id}`);
      if (response.data.success) {
        toast.success(response.data.message);
        fetchLeads();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi xóa");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "new":
        return <span className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-600 rounded-full border border-blue-100">Mới</span>;
      case "contacted":
        return <span className="px-2.5 py-1 text-xs font-bold bg-yellow-50 text-yellow-600 rounded-full border border-yellow-100">Đang chăm sóc</span>;
      case "trial":
        return <span className="px-2.5 py-1 text-xs font-bold bg-purple-50 text-purple-600 rounded-full border border-purple-100">Tập thử</span>;
      case "converted":
        return <span className="px-2.5 py-1 text-xs font-bold bg-green-50 text-green-600 rounded-full border border-green-100">Đã chốt</span>;
      case "lost":
        return <span className="px-2.5 py-1 text-xs font-bold bg-red-50 text-red-600 rounded-full border border-red-100">Thất bại</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold bg-gray-50 text-gray-600 rounded-full">Không rõ</span>;
    }
  };

  const getSourceLabel = (source) => {
    const dict = { facebook: "Facebook", hotline: "Hotline", referral: "Giới thiệu", web: "Website", other: "Khác" };
    return dict[source] || source;
  };

  return (
    <div className="flex flex-col gap-6 font-display p-6 max-w-7xl mx-auto">
      {/* Header Summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Users size={28} /> Quản Lý Khách Hàng Tiềm Năng
          </h2>
          <p className="text-blue-100/90 text-sm mt-1">
            Theo dõi, chăm sóc khách hàng và chuyển đổi thành hội viên chính thức
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ name: "", phone: "", email: "", source: "facebook", assignedSale: "", note: "" });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 shadow-md transition-all shrink-0"
        >
          <Plus size={18} /> Thêm Lead Mới
        </button>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc số điện thoại..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="new">Mới</option>
          <option value="contacted">Đang chăm sóc</option>
          <option value="trial">Tập thử</option>
          <option value="converted">Đã chốt</option>
          <option value="lost">Thất bại</option>
        </select>
        <select
          className="w-full p-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="">Tất cả nguồn khách</option>
          <option value="facebook">Facebook</option>
          <option value="hotline">Hotline</option>
          <option value="referral">Giới thiệu</option>
          <option value="web">Website</option>
          <option value="other">Khác</option>
        </select>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Đang tải dữ liệu...</div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-gray-400">Không tìm thấy khách hàng tiềm năng nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Tên & Thông tin liên hệ</th>
                  <th className="px-6 py-4">Nguồn khách</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4">Sale phụ trách</th>
                  <th className="px-6 py-4">Ngày tạo</th>
                  <th className="px-6 py-4 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {leads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-bold text-gray-800">{lead.name}</p>
                        <div className="flex gap-4 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1"><Phone size={12} /> {lead.phone}</span>
                          {lead.email && <span className="flex items-center gap-1"><Mail size={12} /> {lead.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-600">
                      {getSourceLabel(lead.source)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(lead.status)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {lead.assignedSale ? lead.assignedSale.fullName || lead.assignedSale.username : <span className="text-gray-400 italic">Chưa phân phối</span>}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(lead.createdAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setShowDetailsModal(true);
                          }}
                          title="Lịch sử chăm sóc"
                          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        >
                          <MessageSquare size={16} />
                        </button>
                        {lead.status !== "converted" && (
                          <button
                            onClick={() => handleConvertLead(lead)}
                            title="Chuyển đổi thành hội viên chính thức"
                            className="p-1.5 hover:bg-green-50 text-green-600 rounded-lg transition-colors"
                          >
                            <UserCheck size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setFormData({
                              name: lead.name,
                              phone: lead.phone,
                              email: lead.email,
                              source: lead.source,
                              status: lead.status,
                              assignedSale: lead.assignedSale?._id || "",
                            });
                            setShowEditModal(true);
                          }}
                          title="Chỉnh sửa"
                          className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteLead(lead._id)}
                          title="Xóa"
                          className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <form onSubmit={handleCreateLead} className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white">
              <h3 className="font-bold text-lg">Thêm khách hàng tiềm năng</h3>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên khách hàng *</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số điện thoại *</label>
                <input
                  type="tel"
                  required
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                <input
                  type="email"
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nguồn khách</label>
                  <select
                    className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    <option value="facebook">Facebook</option>
                    <option value="hotline">Hotline</option>
                    <option value="referral">Giới thiệu</option>
                    <option value="web">Website</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nhân viên phụ trách</label>
                  <select
                    className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                    value={formData.assignedSale}
                    onChange={(e) => setFormData({ ...formData, assignedSale: e.target.value })}
                  >
                    <option value="">-- Phân công --</option>
                    {sales.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.fullName || s.username} ({s.role.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú chăm sóc đầu tiên</label>
                <textarea
                  rows={3}
                  placeholder="Ví dụ: Quan tâm gói tập 3 tháng, muốn tập thử..."
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-300 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-background-dark rounded-xl font-bold hover:bg-primary/90 text-sm shadow-md transition-all"
              >
                Lưu lại
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <form onSubmit={handleUpdateLead} className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white">
              <h3 className="font-bold text-lg">Cập nhật khách hàng tiềm năng</h3>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên khách hàng *</label>
                <input
                  type="text"
                  required
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số điện thoại *</label>
                <input
                  type="tel"
                  required
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                <input
                  type="email"
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nguồn khách</label>
                  <select
                    className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    <option value="facebook">Facebook</option>
                    <option value="hotline">Hotline</option>
                    <option value="referral">Giới thiệu</option>
                    <option value="web">Website</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nhân viên phụ trách</label>
                  <select
                    className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50"
                    value={formData.assignedSale}
                    onChange={(e) => setFormData({ ...formData, assignedSale: e.target.value })}
                  >
                    <option value="">-- Phân công --</option>
                    {sales.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.fullName || s.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Trạng thái chăm sóc</label>
                <select
                  className="w-full p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50 font-bold"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="new">Mới (New)</option>
                  <option value="contacted">Đang chăm sóc (Contacted)</option>
                  <option value="trial">Tập thử (Trial)</option>
                  <option value="converted">Đã chốt (Converted)</option>
                  <option value="lost">Thất bại (Lost)</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-300 text-sm"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-background-dark rounded-xl font-bold hover:bg-primary/90 text-sm shadow-md transition-all"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Details & Care Notes Modal */}
      {showDetailsModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg">{selectedLead.name}</h3>
                <p className="text-xs text-blue-100">{selectedLead.phone}</p>
              </div>
              {getStatusBadge(selectedLead.status)}
            </div>

            {/* Care Notes List */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              <h4 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-1.5 text-sm">
                <FileText size={16} /> Lịch sử chăm sóc ({selectedLead.notes?.length || 0})
              </h4>
              
              {selectedLead.notes && selectedLead.notes.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {selectedLead.notes.map((n, i) => (
                    <div key={i} className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                      <div className="flex justify-between items-center mb-1 text-xs font-semibold text-gray-500">
                        <span className="text-blue-600 font-bold">{n.author}</span>
                        <span>{new Date(n.date).toLocaleString("vi-VN")}</span>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{n.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic text-center py-6 text-sm">Chưa có nhật ký chăm sóc nào</p>
              )}
            </div>

            {/* Add New Note */}
            <form onSubmit={handleAddNote} className="p-6 bg-gray-50 border-t border-gray-100 shrink-0">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Thêm ghi chú chăm sóc mới</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập nội dung trao đổi..."
                  className="flex-1 p-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!newNote.trim()}
                  className="px-4 py-2.5 bg-primary text-background-dark rounded-xl font-bold hover:bg-primary/90 text-sm shadow-md transition-all disabled:opacity-50"
                >
                  Gửi
                </button>
              </div>
            </form>

            <div className="px-6 py-4 bg-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-400 text-sm"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leads;
