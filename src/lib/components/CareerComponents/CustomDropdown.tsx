"use client";
import { useState } from "react";

export default function CustomDropdown(props) {
  const { onSelectSetting, screeningSetting, settingList, placeholder, isError } = props;
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="dropdown w-100" style={{ outline: isError ? "2px solid #FDA29B" : "none", borderRadius: "0.375rem" }}>
      <button
        disabled={settingList.length === 0}
        className="dropdown-btn fade-in-bottom"
        style={{ width: "100%", textTransform: "capitalize", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" }}
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
      >
        <span style={{ color: screeningSetting ? "#181D27" : "#717680" }}>
          <i className={settingList.find((setting) => setting.name === screeningSetting)?.icon} /> {screeningSetting?.replace("_", " ") || placeholder}
        </span>
        <i className="la la-angle-down ml-10" />
      </button>

      <div
        className={`dropdown-menu w-100 mt-1 org-dropdown-anim${dropdownOpen ? " show" : ""}`}
        style={{
          padding: "10px",
          maxHeight: 200,
          overflowY: "auto",
        }}
      >
        {settingList.map((setting, index) => (
          <div style={{ borderBottom: "1px solid #ddd" }} key={index}>
            <button
              className="dropdown-item d-flex align-items-center"
              style={{
                minWidth: 220,
                borderRadius: screeningSetting === setting.name ? 0 : 10,
                overflow: "hidden",
                paddingBottom: 10,
                paddingTop: 10,
                color: "#181D27",
                fontWeight: screeningSetting === setting.name ? 700 : 500,
                background: screeningSetting === setting.name ? "#F8F9FC" : "transparent",
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                whiteSpace: "wrap",
                textTransform: "capitalize",
              }}
              onClick={() => {
                onSelectSetting(setting.name);
                setDropdownOpen(false);
              }}
            >
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
                {setting.icon && <i className={setting.icon}></i>} {setting.name?.replace("_", " ")}
              </div>
              {setting.name === screeningSetting && (
                <i
                  className="la la-check"
                  style={{
                    fontSize: "20px",
                    background: "linear-gradient(180deg, #9FCAED 0%, #CEB6DA 33%, #EBACC9 66%, #FCCEC0 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
