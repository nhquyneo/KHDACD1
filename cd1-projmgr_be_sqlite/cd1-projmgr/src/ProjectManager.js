import React, { useEffect, useMemo, useState } from "react";
import {
  getProjects,
  createProject,
  updateProject,
  deleteProjectApi,
} from "./api";
import * as XLSX from "xlsx";

const PHASE_NAMES = [
  "Flowchart",
  "BV mạch lực",
  "Layout",
  "LKTC",
  "Đặt GS",
  "HTBV",
  "Nameplate",
  "Test LK",
  "Bật nguồn",
  "Check GH",
  "Giao hàng",
];

const emptyProject = {
  id: null,
  name: "",
  codeSale: "",
  owner: "",
  level: "",
  currentStatus: "",
  phases: PHASE_NAMES.map((name) => ({
    name,
    status: "O",
    dueDate: "",
    actualDate: "-",
    progress: 0,
  })),
};

function ProjectManager() {
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({
    search: "",
    owner: "",
    level: "",
    status: "",
  });
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formProject, setFormProject] = useState(emptyProject);
  const [owners, setOwners] = useState([]);

  // ===== Helper format thời gian cập nhật =====
  const formatDateTime = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value || "-";

    return d.toLocaleString("vi-VN", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // ===================== LOAD DATA + POLLING =====================
  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
      const ownerSet = new Set(
        data.map((p) => p.owner).filter((o) => o && o.trim() !== "")
      );
      setOwners([...ownerSet]);
    } catch (err) {
      console.error(err);
      alert("Không tải được dữ liệu project từ server");
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const intervalMs = isProjectModalOpen ? 1000 : 1000;
    const intervalId = setInterval(() => {
      loadProjects();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [isProjectModalOpen]);
  // ================== HẾT PHẦN LOAD DATA + POLLING ==================

  // statistics
  const stats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter((p) =>
      p.phases.every((ph) => ph.status === "F")
    ).length;
    const delayed = projects.filter((p) =>
      p.phases.some((ph) => ph.status === "FD" || ph.status === "S")
    ).length;
    return { total, completed, delayed };
  }, [projects]);

  // filter
  const filteredProjects = useMemo(() => {
    const { search, owner, level, status } = filters;
    return projects.filter((p) => {
      const searchText = search.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(searchText) ||
        (p.codeSale && p.codeSale.toLowerCase().includes(searchText));
      const matchesOwner = !owner || p.owner === owner;
      const matchesLevel = !level || p.level === level;
      const matchesStatus =
        !status || p.phases.some((ph) => ph.status === status);

      return matchesSearch && matchesOwner && matchesLevel && matchesStatus;
    });
  }, [projects, filters]);

  // ================== EXPORT XLSX (HEADER 2 DÒNG + MERGE Ô) ==================
  const handleExport = () => {
    try {
      // tổng cột: 5 cột đầu + 11 phase + 2 cột cuối = 18
      const phaseCount = PHASE_NAMES.length;

      // Row 1: STT, Tên dự án, Code Sale, Người phụ trách, Cấp độ, "Các công đoạn thiết kế", (trống cho phần merge), Hiện trạng, Thời gian cập nhật
      const headerRow1 = [
        "STT",
        "Tên dự án",
        "Code Sale",
        "Người phụ trách",
        "Cấp độ",
        "Các công đoạn thiết kế",
        ...Array(phaseCount - 1).fill(""),
        "Hiện trạng",
        "Thời gian cập nhật",
      ];

      // Row 2: trống 5 cột đầu, tên các công đoạn, trống 2 cột cuối
      const headerRow2 = [
        "",
        "",
        "",
        "",
        "",
        ...PHASE_NAMES,
        "",
        "",
      ];

      // Data rows
      const dataRows = filteredProjects.map((p, idx) => {
        const baseCols = [
          idx + 1,
          p.name || "",
          p.codeSale || "",
          p.owner || "",
          p.level || "",
        ];

        const phaseCols = PHASE_NAMES.map((phaseName) => {
          const ph = p.phases?.find((x) => x.name === phaseName) || {};
          const status = ph.status || "";
          const plan = ph.dueDate || "";
          const actual = ph.actualDate || "";
          const progress =
            typeof ph.progress === "number" ? `${ph.progress}%` : "";

          return `Status: ${status}
Plan: ${plan}
Actual: ${actual}
Progress: ${progress}`;
        });

        const tailCols = [
          p.currentStatus || "",
          formatDateTime(p.updatedAt),
        ];

        return [...baseCols, ...phaseCols, ...tailCols];
      });

      const wsData = [headerRow1, headerRow2, ...dataRows];

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Thiết lập merge để header giống Excel mẫu
      // index cột: 0..17
      const merges = [
        // STT, Tên dự án, Code Sale, Người phụ trách, Cấp độ (merge theo chiều dọc 2 dòng)
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
        { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
        { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },

        // Ô "Các công đoạn thiết kế" ngang qua 11 công đoạn (cột 5 -> 15, dòng 1)
        { s: { r: 0, c: 5 }, e: { r: 0, c: 5 + phaseCount - 1 } },

        // Hiện trạng, Thời gian cập nhật (merge dọc 2 dòng)
        { s: { r: 0, c: 5 + phaseCount }, e: { r: 1, c: 5 + phaseCount } },
        { s: { r: 0, c: 5 + phaseCount + 1 }, e: { r: 1, c: 5 + phaseCount + 1 } },
      ];

      ws["!merges"] = merges;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Projects");

      // Tạo tên file KHDACD1_yyMMdd.xlsx
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const MM = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const fileName = `KHDACD1_${yy}${MM}${dd}.xlsx`;

      XLSX.writeFile(wb, fileName);

    } catch (err) {
      console.error(err);
      alert("Export thất bại");
    }
  };
  // ================== HẾT EXPORT XLSX ==================

  // mở modal thêm
  const openAddModal = () => {
    setEditingProject(null);
    setFormProject(emptyProject);
    setProjectModalOpen(true);
  };

  // mở modal sửa
  const openEditModal = (project) => {
    setEditingProject(project);
    setFormProject({
      id: project.id,
      name: project.name,
      codeSale: project.codeSale || "",
      owner: project.owner || "",
      level: project.level || "",
      currentStatus: project.currentStatus || "",
      phases: project.phases.map((ph) => ({ ...ph })),
    });
    setProjectModalOpen(true);
  };

  const closeModal = () => {
    setProjectModalOpen(false);
    setEditingProject(null);
  };

  // handle change input project
  const handleProjectChange = (field, value) => {
    setFormProject((prev) => ({ ...prev, [field]: value }));
  };

  // handle change phase
  const handlePhaseChange = (idx, field, value) => {
    setFormProject((prev) => {
      const newPhases = [...prev.phases];
      const oldPhase = newPhases[idx];
      let updated = { ...oldPhase };

      if (field === "status") {
        if (value === "F" || value === "FD") {
          if (!oldPhase.dueDate || oldPhase.dueDate.trim() === "") {
            alert("Bạn phải nhập PLAN trước khi đổi trạng thái sang F/FD!");
            return prev;
          }

          if (
            !oldPhase.actualDate ||
            oldPhase.actualDate === "-" ||
            oldPhase.actualDate.trim() === ""
          ) {
            alert("Bạn phải nhập ACTUAL trước khi đổi trạng thái sang F/FD!");
            return prev;
          }

          updated.status = value;
          updated.progress = 100;
        } else {
          updated.status = value;
        }
      } else if (field === "progress") {
        updated.progress = Number(value || 0);
      } else {
        updated[field] = value;
      }

      newPhases[idx] = updated;
      return { ...prev, phases: newPhases };
    });
  };

  // submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProject && formProject.id) {
        await updateProject(formProject.id, formProject);
      } else {
        await createProject(formProject);
      }
      await loadProjects();
      closeModal();
    } catch (err) {
      console.error(err);
      alert("Lưu dự án thất bại");
    }
  };

  const handleDelete = async (project) => {
    if (!window.confirm(`Xoá dự án "${project.name}"?`)) return;
    try {
      await deleteProjectApi(project.id);
      await loadProjects();
    } catch (err) {
      console.error(err);
      alert("Xoá dự án thất bại");
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <header>
        <h1>QUẢN LÝ TIẾN ĐỘ DỰ ÁN CD1</h1>
        <div className="user-controls">
          <button id="userManagementBtn" className="btn-secondary">
            👤 Quản lý User
          </button>
        </div>
      </header>

      {/* Controls */}
      <div className="controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Tìm kiếm dự án..."
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
          />
          <select
            value={filters.owner}
            onChange={(e) =>
              setFilters((f) => ({ ...f, owner: e.target.value }))
            }
          >
            <option value="">Tất cả người phụ trách</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select
            value={filters.level}
            onChange={(e) =>
              setFilters((f) => ({ ...f, level: e.target.value }))
            }
          >
            <option value="">Tất cả cấp độ</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
            <option value="S">S</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value }))
            }
          >
            <option value="">Tất cả trạng thái</option>
            <option value="F">Hoàn thành đúng hạn</option>
            <option value="FD">Hoàn thành chậm</option>
            <option value="S">Đang thực hiện (chậm)</option>
            <option value="O">Đang thực hiện theo tiến độ</option>
          </select>

          <button
            onClick={() => {
              /* filter dùng useMemo rồi nên không cần */
            }}
          >
            Tìm kiếm
          </button>
          <button id="addProjectBtn" onClick={openAddModal}>
            + Thêm dự án
          </button>
          <button
            id="exportBtn"
            className="btn-secondary"
            onClick={handleExport}
          >
            📥 Export
          </button>
        </div>

        {/* Legend + stats */}
        <div className="legend-stats">
          <div className="legend">
            <div className="legend-item">
              <div className="legend-color status-f"></div>
              <span>F - Hoàn thành đúng hạn</span>
            </div>
            <div className="legend-item">
              <div className="legend-color status-fd"></div>
              <span>FD - Hoàn thành chậm</span>
            </div>
            <div className="legend-item">
              <div className="legend-color status-s"></div>
              <span>S - Đang thực hiện (chậm)</span>
            </div>
            <div className="legend-item">
              <div className="legend-color status-o"></div>
              <span>O - Đang thực hiện theo tiến độ</span>
            </div>
          </div>
          <div className="stats">
            <div className="stat-item">
              <span className="stat-number" id="totalProjects">
                {stats.total}
              </span>
              <span className="stat-label">Tổng dự án</span>
            </div>
            <div className="stat-item">
              <span className="stat-number" id="completedProjects">
                {stats.completed}
              </span>
              <span className="stat-label">Hoàn thành</span>
            </div>
            <div className="stat-item">
              <span className="stat-number" id="delayedProjects">
                {stats.delayed}
              </span>
              <span className="stat-label">Chậm tiến độ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr className="header-row-1">
              <th rowSpan="2" className="col-stt">
                STT
              </th>
              <th rowSpan="2" className="col-project">
                Tên dự án
              </th>
              <th rowSpan="2">Code Sale</th>
              <th rowSpan="2">Người phụ trách</th>
              <th rowSpan="2">Cấp độ</th>
              <th rowSpan="2" className="implementation-header">
                <div className="implementation-title">Thực hiện</div>
                <div className="implementation-subtitle">
                  Status | Plan | Actual | Progress
                </div>
              </th>
              <th colSpan="11" className="phase-group-header">
                Các công đoạn thiết kế
              </th>
              <th rowSpan="2">Hiện trạng</th>
              <th rowSpan="2">Thời gian cập nhật</th>
              <th rowSpan="2">Thao tác</th>
            </tr>
            <tr className="header-row-2">
              {PHASE_NAMES.map((name) => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={20} style={{ textAlign: "center", padding: 20 }}>
                  Không có dự án nào được tìm thấy
                </td>
              </tr>
            ) : (
              filteredProjects.map((p, idx) => (
                <tr key={p.id}>
                  <td className="col-stt">{idx + 1}</td>
                  <td className="col-project">
                    <div className="project-name">{p.name}</div>
                  </td>
                  <td>{p.codeSale || "-"}</td>
                  <td>{p.owner || "-"}</td>
                  <td className="level-cell">{p.level || "-"}</td>

                  <td className="implementation-cell">
                    <div className="implementation-info">
                      <div
                        style={{
                          fontSize: "9px",
                          color: "#666",
                          lineHeight: 1.3,
                          textAlign: "center",
                          padding: "5px 2px",
                        }}
                      >
                        <div>
                          <strong>Status</strong>
                        </div>
                        <div>
                          <strong>Plan</strong>
                        </div>
                        <div>
                          <strong>Actual</strong>
                        </div>
                        <div>
                          <strong>Progress</strong>
                        </div>
                      </div>
                    </div>
                  </td>

                  {p.phases.map((ph) => (
                    <td key={ph.name} className="phase-cell">
                      <div className="phase-info">
                        <span
                          className={`phase-status status-${ph.status.toLowerCase()}`}
                        >
                          {ph.status}
                        </span>
                        <div className="phase-dates">
                          📅 {ph.dueDate || ""}
                          <br />
                          📆 {ph.actualDate || "-"}
                        </div>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${ph.status.toLowerCase()}`}
                            style={{ width: `${ph.progress || 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                  ))}

                  <td>{p.currentStatus || "-"}</td>
                  <td>{formatDateTime(p.updatedAt)}</td>

                  <td className="action-cell">
                    <div className="action-buttons">
                      <button
                        className="btn-secondary"
                        onClick={() => openEditModal(p)}
                      >
                        Sửa
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => handleDelete(p)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal dự án */}
      {isProjectModalOpen && (
        <div className="modal" style={{ display: "block" }}>
          <div className="modal-content large-modal">
            <div className="modal-header">
              <h2>{editingProject ? "Sửa dự án" : "Thêm dự án mới"}</h2>
              <span className="close" onClick={closeModal}>
                &times;
              </span>
            </div>
            <div className="modal-body">
              <form id="projectForm" onSubmit={handleSubmit}>
                <div className="form-section">
                  <h3>Thông tin dự án</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="projectName">Tên dự án:</label>
                      <input
                        type="text"
                        id="projectName"
                        required
                        value={formProject.name}
                        onChange={(e) =>
                          handleProjectChange("name", e.target.value)
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="projectCode">Code Sale:</label>
                      <input
                        type="text"
                        id="projectCode"
                        value={formProject.codeSale}
                        onChange={(e) =>
                          handleProjectChange("codeSale", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="projectOwner">Người phụ trách:</label>
                      <input
                        type="text"
                        id="projectOwner"
                        required
                        value={formProject.owner}
                        onChange={(e) =>
                          handleProjectChange("owner", e.target.value)
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="projectLevel">Cấp độ:</label>
                      <select
                        id="projectLevel"
                        value={formProject.level}
                        onChange={(e) =>
                          handleProjectChange("level", e.target.value)
                        }
                      >
                        <option value="">Chọn cấp độ</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="E">E</option>
                        <option value="S">S</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="projectStatus">Hiện trạng:</label>
                      <input
                        type="text"
                        id="projectStatus"
                        value={formProject.currentStatus}
                        onChange={(e) =>
                          handleProjectChange("currentStatus", e.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Lập kế hoạch các công đoạn</h3>
                  <div className="phases-planning">
                    <div className="phase-planning-header">
                      <span>Công đoạn</span>
                      <span>Status</span>
                      <span>Plan</span>
                      <span>Actual</span>
                      <span>Progress</span>
                    </div>
                    <div id="phasesContainer">
                      {formProject.phases.map((ph, idx) => (
                        <div
                          key={ph.name}
                          className="phase-planning-item"
                          data-phase={ph.name}
                        >
                          <div className="phase-name">{ph.name}</div>
                          <select
                            className="phase-select phase-status"
                            value={ph.status}
                            onChange={(e) =>
                              handlePhaseChange(idx, "status", e.target.value)
                            }
                          >
                            <option value="O">
                              O - Đang thực hiện theo tiến độ
                            </option>
                            <option value="S">
                              S - Đang thực hiện (chậm)
                            </option>
                            <option value="F">F - Hoàn thành đúng hạn</option>
                            <option value="FD">FD - Hoàn thành chậm</option>
                          </select>
                          <input
                            type="text"
                            className="phase-input phase-plan"
                            value={ph.dueDate}
                            placeholder="dd/mm"
                            onChange={(e) =>
                              handlePhaseChange(idx, "dueDate", e.target.value)
                            }
                          />
                          <input
                            type="text"
                            className="phase-input phase-actual"
                            value={ph.actualDate === "-" ? "" : ph.actualDate}
                            placeholder="dd/mm"
                            onChange={(e) =>
                              handlePhaseChange(
                                idx,
                                "actualDate",
                                e.target.value || "-"
                              )
                            }
                          />
                          <input
                            type="number"
                            className="phase-progress-input phase-progress"
                            min={0}
                            max={100}
                            value={ph.progress}
                            onChange={(e) =>
                              handlePhaseChange(idx, "progress", e.target.value)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary">
                    Lưu dự án
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={closeModal}
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectManager;
