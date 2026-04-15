"use client";

import { useState, useRef, useEffect } from "react";
import { Option, CustomSelectProps } from "@/lib/types";

function useCustomSelectLogic(
  value: string,
  options: Option[],
  onChange: (value: string) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // handle closing when clicking outside the component
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    // dynamically check screen space before opening
    if (!isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;

      // if there's less than 250px of space below, open upwards!
      if (spaceBelow < 250) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }
    }
    setIsOpen(!isOpen);
  };

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  return {
    isOpen,
    dropUp,
    dropdownRef,
    selectedOption,
    handleToggle,
    handleSelect,
  };
}

export default function CustomSelect({
  value,
  onChange,
  options,
  className = "",
}: CustomSelectProps) {
  const {
    isOpen,
    dropUp,
    dropdownRef,
    selectedOption,
    handleToggle,
    handleSelect,
  } = useCustomSelectLogic(value, options, onChange);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between bg-white border-2 border-stone-100 shadow-sm rounded-2xl px-4 py-3.5 text-sm font-bold text-stone-600 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all active:scale-[0.98]"
      >
        <span>{selectedOption?.label || "select..."}</span>
        <svg
          className={`w-4 h-4 text-stone-400 transition-transform duration-300 ${
            isOpen ? (dropUp ? "-rotate-180" : "rotate-180") : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu List */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 bg-white border-2 border-stone-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in duration-200 ${
            dropUp
              ? "bottom-[calc(100%+8px)] slide-in-from-bottom-2"
              : "top-[calc(100%+8px)] slide-in-from-top-2 mt-2"
          }`}
        >
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${
                  value === option.value
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
