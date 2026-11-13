import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, todayStr, formatExperience } from '../api.js';
import { useTheme } from '../App.jsx';
import Ring from '../Ring.jsx';
import { GlassFold } from '@/components/ui/glass-fold';
import { LiquidNavbar } from '@/components/ui/liquid-glass-navbar';
import TeamLanyardRail from '@/components/ui/team-lanyard-rail';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const DEFAULT_16_WORKERS = [
  { id: 'W001', name: 'Shahed Ahmed Siraj', department: 'Ext. Manpower', worker_type: 'contract', designation: 'External Contractor', doj: null, presentDays: 24, totalDutyHours: 192, totalOvertimeHours: 28, totalWage: 1870, duty_rate_hr: 8.5 },
  { id: 'W002', name: 'Ahmad Habib', department: 'Ext. Manpower', worker_type: 'contract', designation: 'External Contractor', doj: null, presentDays: 25, totalDutyHours: 200, totalOvertimeHours: 32, totalWage: 1972, duty_rate_hr: 8.5 },
  { id: 'W003', name: 'Nascon Buse', department: 'Ext. Manpower', worker_type: 'contract', designation: 'External Contractor', doj: null, presentDays: 22, totalDutyHours: 176, totalOvertimeHours: 18, totalWage: 2910, duty_rate_hr: 15 },
  { id: 'W004', name: 'Usaman Transport', department: 'Ext. Manpower', worker_type: 'contract', designation: 'Transport Contractor', doj: null, presentDays: 26, totalDutyHours: 208, totalOvertimeHours: 40, totalWage: 2480, duty_rate_hr: 10 },
  { id: 'W005', name: 'Sulthan Abdul Kadar', department: 'Electrical', worker_type: 'company', designation: 'Electrical Engineer', doj: '2023-05-01', presentDays: 26, totalDutyHours: 208, totalOvertimeHours: 14, totalWage: 3500, duty_rate_hr: 0 },
  { id: 'W006', name: 'Alli Radha', department: 'General', worker_type: 'company', designation: 'Operations Lead', doj: '2022-01-27', presentDays: 25, totalDutyHours: 200, totalOvertimeHours: 10, totalWage: 2000, duty_rate_hr: 0 },
  { id: 'W007', name: 'Prabakaran Selvarasu', department: 'Electrical', worker_type: 'company', designation: 'Electrician Assistant', doj: '2023-06-16', presentDays: 24, totalDutyHours: 192, totalOvertimeHours: 20, totalWage: 900, duty_rate_hr: 0 },
  { id: 'W008', name: 'Ganagasabai Subramanian', department: 'Plumbing', worker_type: 'company', designation: 'Plumber', doj: '2023-06-16', presentDays: 25, totalDutyHours: 200, totalOvertimeHours: 16, totalWage: 1200, duty_rate_hr: 0 },
  { id: 'W009', name: 'Aravindran Rajendran', department: 'Electrical', worker_type: 'company', designation: 'Electrician Assistant', doj: '2023-03-28', presentDays: 23, totalDutyHours: 184, totalOvertimeHours: 22, totalWage: 1500, duty_rate_hr: 0 },
  { id: 'W010', name: 'Arulazhagan Goplakrishnan', department: 'Masonry', worker_type: 'company', designation: 'Brick Layer', doj: '2022-05-14', presentDays: 26, totalDutyHours: 208, totalOvertimeHours: 30, totalWage: 1600, duty_rate_hr: 0 },
  { id: 'W011', name: 'Rajiv Nallathampi', department: 'Admin', worker_type: 'company', designation: 'Data Entry Clerk', doj: '2022-05-14', presentDays: 26, totalDutyHours: 208, totalOvertimeHours: 8, totalWage: 900, duty_rate_hr: 0 },
  { id: 'W012', name: 'Krishna Samy', department: 'HVAC', worker_type: 'company', designation: 'A/C Mechanic', doj: '2022-05-14', presentDays: 24, totalDutyHours: 192, totalOvertimeHours: 25, totalWage: 1800, duty_rate_hr: 0 },
  { id: 'W013', name: 'Krishnarasu Kaliyaperumal', department: 'Mechanical', worker_type: 'company', designation: 'Mechanic Assistant', doj: '2023-04-17', presentDays: 25, totalDutyHours: 200, totalOvertimeHours: 18, totalWage: 1200, duty_rate_hr: 0 },
  { id: 'W014', name: 'Moorthy Krishnamoorthy', department: 'General', worker_type: 'company', designation: 'Field Specialist', doj: '2023-08-10', presentDays: 24, totalDutyHours: 192, totalOvertimeHours: 15, totalWage: 900, duty_rate_hr: 0 },
  { id: 'W015', name: 'Muppudathi Periyasamy', department: 'Tiling', worker_type: 'company', designation: 'Tile Layer Assistant', doj: '2023-12-03', presentDays: 25, totalDutyHours: 200, totalOvertimeHours: 22, totalWage: 1300, duty_rate_hr: 0 },
  { id: 'W016', name: 'Michael Kumarimannan', department: 'Masonry', worker_type: 'company', designation: 'Brick Layer', doj: '2022-05-21', presentDays: 26, totalDutyHours: 208, totalOvertimeHours: 20, totalWage: 1200, duty_rate_hr: 0 },
];

const ADMIN_NAV_KEYS = ['dashboard', 'employees', 'payroll', 'manage', 'holidays', 'supervisors'];

const ADMIN_NAV_ITEMS = [
  {
    label: 'Dashboard',
    fx: 'glow',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: 'Employee Track',
    fx: 'wave',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'Payroll',
    fx: 'pulse',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M12 9v6M9 12h6" />
        <line x1="2" y1="9" x2="22" y2="9" />
      </svg>
    ),
  },
  {
    label: 'Manage Workers',
    fx: 'pop',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    ),
  },
  {
    label: 'Holidays',
    fx: 'spin',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: 'Supervisors',
    fx: 'drop',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5L11 9l-1.5-1.5L8 9" />
        <circle cx="7.5" cy="15.5" r="5.5" />
        <path d="m15.5 4.5 4 4" />
      </svg>
    ),
  },
];

const LEAVE_COLS = [
  ['ml', 'ML'], ['annual', 'Annual'], ['emergency', 'Emer.'], ['workRelated', 'Work'], ['casual', 'Casual'], ['unpaid', 'Unpaid'], ['unspecified', 'Unspec.'],
];

const UAE_GOVT_HOLIDAYS = [
  ['01-01', 'New Year\'s Day'],
  ['03-20', 'Isra\'a Wal Mi\'raj'],
  ['03-30', 'Eid Al Fitr (Day 1)'],
  ['03-31', 'Eid Al Fitr (Day 2)'],
  ['04-01', 'Eid Al Fitr (Day 3)'],
  ['06-05', 'Arafat Day (Haj)'],
  ['06-06', 'Eid Al Adha (Day 1)'],
  ['06-07', 'Eid Al Adha (Day 2)'],
  ['06-08', 'Eid Al Adha (Day 3)'],
  ['06-26', 'Al Hijra (Islamic New Year)'],
  ['09-04', 'Prophet Muhammad\'s Birthday'],
  ['11-30', 'Commemoration Day'],
  ['12-02', 'UAE National Day'],
  ['12-03', 'UAE National Day (Day 2)'],
];

function buildExpenseRows(eRows, mp) {
  return eRows.map((r, idx) => {
    const totalHrs = (r.totalDutyHours || 0) + (r.totalOvertimeHours || 0);
    const rov = (r.rov_monthly || 0) * mp;
    const trans = (r.transport_monthly || 0) * mp;
    const otherExp = Math.round((r.other_expense_hr || 0) * totalHrs * 100) / 100;
    const totalCost = Math.round(((r.totalWage || 0) + rov + trans + otherExp) * 100) / 100;
    const dutyPayHr = r.totalDutyHours > 0 ? Math.round(((r.totalDailyWage || 0) / r.totalDutyHours) * 100) / 100 : Number(r.duty_rate_hr || 0);
    const otPayHr = r.totalOvertimeHours > 0 ? Math.round(((r.totalOvertimeWage || 0) / r.totalOvertimeHours) * 100) / 100 : Number(r.ot_rate || 0);
    const addlAllow = (r.additional_allowance || 0) * mp;
    const totalCostFull = Math.round(((r.totalWage || 0) + rov + trans + otherExp + addlAllow) * 100) / 100;
    return [idx + 1, r.name, r.worker_type === 'contract' ? 'Contract' : 'Company', r.primarySite || '–', r.designation || '–', r.presentDays, (r.totalDutyHours || 0).toFixed(1), (r.totalOvertimeHours || 0).toFixed(1), dutyPayHr, otPayHr, Math.round(r.totalDailyWage || 0), Math.round(r.totalOvertimeWage || 0), Math.round(r.totalWage || 0), rov, trans, Math.round(otherExp), addlAllow, Math.round(totalCostFull)];
  });
}
const EXP_COLS = ['#', 'Worker', 'Type', 'Site (most freq.)', 'Designation', 'Present', 'Duty Hrs', 'OT Hrs', 'Duty Pay/Hr', 'OT Pay/Hr', 'Duty Pay', 'OT Pay', 'Total Wages', 'Room/Office/Visa', 'Transport', 'Other Expense', 'Addl. Allowance', 'Total Cost'];

function downloadExpense(fmt, eRows, mp, period, year, filterLabel) {
  const rows = buildExpenseRows(eRows, mp);
  const tag = filterLabel === 'all' ? 'All' : filterLabel === 'company' ? 'Company' : 'ExtWorkers';
  const fname = `Expense_${tag}_${period}_${year}`;
  const totals = EXP_COLS.map((_, ci) => {
    if (ci === 0) return '';
    if (ci === 1) return `Total (${rows.length})`;
    if (ci <= 4) return '';
    if (ci === 8 || ci === 9) return '–';
    return rows.reduce((s, r) => s + (Number(r[ci]) || 0), 0);
  });

  if (fmt === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`Employee Expense — ${tag} — ${period} ${year}`, 14, 16);
    autoTable(doc, {
      head: [EXP_COLS],
      body: rows,
      foot: [totals],
      startY: 22,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    });
    doc.save(`${fname}.pdf`);
  } else if (fmt === 'csv') {
    const lines = [EXP_COLS.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(',')), totals.map(c => `"${c}"`).join(',')];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fname}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else {
    const ws = XLSX.utils.aoa_to_sheet([EXP_COLS, ...rows, totals]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.writeFile(wb, `${fname}.xlsx`);
  }
}

const PAYROLL_EXPORT_COLS = ['#', 'Employee', 'ID', 'Department', 'Type', 'Designation', 'Duty Hrs', 'OT Hrs', 'Base Pay (AED)', 'OT Pay (AED)', 'Allowances (AED)', 'Net Pay (AED)'];

function downloadPayrollReport(fmt, payrollWorkers, period, year, filterLabel) {
  const tag = filterLabel === 'all' ? 'All' : filterLabel === 'company' ? 'Company' : 'ExtWorkers';
  const fname = `Payroll_${tag}_${period}_${year}`;
  const rows = payrollWorkers.map((w, idx) => {
    const isContract = w.worker_type === 'contract';
    const dutyPay = w.totalDailyWage || 0;
    const otPay = w.totalOvertimeWage || 0;
    const addlAllow = Number(w.additional_allowance || 0);
    const allowance = Number(w.allowance || 0);
    const basic = Number(w.basic_salary || 0);
    const basePay = isContract ? dutyPay : basic;
    const allowancesTotal = isContract ? addlAllow : allowance + addlAllow;
    const totalPay = isContract
      ? dutyPay + otPay + addlAllow
      : basic + allowance + addlAllow + otPay;
    return [
      idx + 1,
      w.name,
      w.id || '–',
      w.department || '–',
      isContract ? 'Contract' : 'Company',
      w.designation || '–',
      Number((w.totalDutyHours || 0).toFixed(1)),
      Number((w.totalOvertimeHours || 0).toFixed(1)),
      Math.round(basePay),
      Math.round(otPay),
      Math.round(allowancesTotal),
      Math.round(totalPay),
    ];
  });

  const totals = [
    '',
    `Total (${rows.length})`,
    '', '', '', '',
    Number(rows.reduce((s, r) => s + (Number(r[6]) || 0), 0).toFixed(1)),
    Number(rows.reduce((s, r) => s + (Number(r[7]) || 0), 0).toFixed(1)),
    rows.reduce((s, r) => s + (Number(r[8]) || 0), 0),
    rows.reduce((s, r) => s + (Number(r[9]) || 0), 0),
    rows.reduce((s, r) => s + (Number(r[10]) || 0), 0),
    rows.reduce((s, r) => s + (Number(r[11]) || 0), 0),
  ];

  if (fmt === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`Payroll Summary Report — ${tag} — ${period} ${year}`, 14, 16);
    autoTable(doc, {
      head: [PAYROLL_EXPORT_COLS],
      body: rows,
      foot: [totals],
      startY: 22,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    });
    doc.save(`${fname}.pdf`);
  } else if (fmt === 'csv') {
    const lines = [PAYROLL_EXPORT_COLS.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(',')), totals.map(c => `"${c}"`).join(',')];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fname}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else {
    const ws = XLSX.utils.aoa_to_sheet([PAYROLL_EXPORT_COLS, ...rows, totals]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll Summary');
    XLSX.writeFile(wb, `${fname}.xlsx`);
  }
}

function numToWords(n) {
  if (n === 0) return 'Zero';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function convert(num) {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' and ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + convert(num % 10000000) : '');
  }
  const whole = Math.floor(Math.abs(n));
  const fils = Math.round((Math.abs(n) - whole) * 100);
  let result = 'AED ' + convert(whole);
  if (fils > 0) result += ' and ' + convert(fils) + ' Fils';
  return result + ' Only';
}

let _tplCache = null;
async function loadPayslipTemplate() {
  if (_tplCache) return _tplCache;
  const resp = await fetch('/payslip-template.png');
  const blob = await resp.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => { _tplCache = reader.result; resolve(reader.result); };
    reader.readAsDataURL(blob);
  });
}

const P = 210 / 1055;
const IMG_H = 1491 * P;

function generatePayslipPage(doc, w, monthLabel, year, mp, isFirst, tplImg) {
  if (!isFirst) doc.addPage();

  doc.addImage(tplImg, 'PNG', 0, 0, 210, IMG_H);

  const dutyHrs = w.totalDutyHours || 0;
  const otHrs = w.totalOvertimeHours || 0;
  const dutyPay = w.totalDailyWage || 0;
  const otPay = w.totalOvertimeWage || 0;
  const isContract = w.worker_type === 'contract';
  const dutyRate = dutyHrs > 0 ? dutyPay / dutyHrs : Number(w.duty_rate_hr || 0);
  const otRate = otHrs > 0 ? otPay / otHrs : Number(w.ot_rate || 0);
  const basic = Number(w.basic_salary || 0);
  const allowance = Number(w.allowance || 0);
  const addlAllow = Number(w.additional_allowance || 0);
  const absent = w.absentDays || 0;
  const doj = w.doj ? String(w.doj).slice(0, 10) : '–';

  const totalEarnings = isContract
    ? dutyPay + otPay + addlAllow
    : basic + allowance + addlAllow + otPay;
  const totalDeductions = 0;
  const netSalary = totalEarnings - totalDeductions;

  const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const mName = mp === 1 ? (MONTHS[Number(monthLabel)] || monthLabel) : monthLabel;

  // px helper: converts image pixel x,y to PDF mm (P = 210 / 1055)
  const x = px => px * P;
  const y = px => px * P;

  doc.setTextColor(51, 33, 0);

  // ── 1. Month (centered inside the Month pill box at top right) ──
  // Pill interior: x = 860..1019 -> center = 939.5; y = 231..279 -> center = 255.0
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`${mName} ${year}`, x(939.5), y(255), { align: 'center', baseline: 'middle' });

  // ── 2. Employee Info Box (y = 307..400, vertical center of icon/value row = 362.5) ──
  // Employee Name: aligned with "Employee Name" label (x = 162), dynamically adjusted if long
  const nameFontSize = doc.getTextWidth(w.name) > 55 ? 7.5 : 8.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(nameFontSize);
  doc.text(w.name, x(162), y(362.5), { baseline: 'middle', maxWidth: x(280) });

  // Designation: centered directly under "Designation" label (label x = 459..546 -> center = 502.5)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(w.designation || '–', x(502.5), y(362.5), { align: 'center', baseline: 'middle', maxWidth: x(190) });

  // DOJ: placed to the right of the calendar icon (icon: x = 663..688, y = 349..376)
  // At x = 705, leaving a generous 17px (~3.4 mm) margin past the calendar icon
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(doj, x(705), y(362.5), { baseline: 'middle' });

  // Absent Days: placed to the right of the person icon (icon: x = 875..901)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(String(absent), x(945), y(362.5), { align: 'center', baseline: 'middle' });

  // ── 3. Table Column Centers ──
  // Details column: x = 383..582 -> Center = 482.5 px
  // Rate / Amount column: x = 582..845 -> Center = 713.5 px
  // Amount column: x = 845..1026 -> Center = 935.5 px
  const cDet  = x(482.5);
  const cRate = x(713.5);
  const cAmt  = x(935.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  // ── Row 1: Working Hours (y = 488..531, midpoint = 509.5) ──
  const rWork = y(509.5);
  doc.text(`${dutyHrs.toFixed(1)} hrs`, cDet, rWork, { align: 'center', baseline: 'middle' });
  doc.text(`${dutyRate.toFixed(2)} /hr`, cRate, rWork, { align: 'center', baseline: 'middle' });
  doc.text(dutyPay.toFixed(2), cAmt, rWork, { align: 'center', baseline: 'middle' });

  // ── Row 2: Overtime Hours (y = 531..573, midpoint = 552.0) ──
  const rOt = y(552.0);
  doc.text(`${otHrs.toFixed(1)} hrs`, cDet, rOt, { align: 'center', baseline: 'middle' });
  doc.text(`${otRate.toFixed(2)} /hr`, cRate, rOt, { align: 'center', baseline: 'middle' });
  doc.text(otPay.toFixed(2), cAmt, rOt, { align: 'center', baseline: 'middle' });

  // ── Row 3: Leave (y = 573..615, midpoint = 594.0) ──
  const rLeave = y(594.0);
  doc.text(`${absent} days`, cDet, rLeave, { align: 'center', baseline: 'middle' });
  doc.text('–', cRate, rLeave, { align: 'center', baseline: 'middle' });
  doc.text('–', cAmt, rLeave, { align: 'center', baseline: 'middle' });

  // ── Row 5: EARNINGS Basic (y = 657..697, midpoint = 677.0) ──
  const rBasic = y(677.0);
  doc.text('Monthly', cDet, rBasic, { align: 'center', baseline: 'middle' });
  doc.text(basic.toFixed(2), cRate, rBasic, { align: 'center', baseline: 'middle' });
  doc.text(basic.toFixed(2), cAmt, rBasic, { align: 'center', baseline: 'middle' });

  // ── Row 6: EARNINGS Allowance (y = 697..736, midpoint = 716.5) ──
  const rAllow = y(716.5);
  doc.text('Monthly', cDet, rAllow, { align: 'center', baseline: 'middle' });
  doc.text(allowance.toFixed(2), cRate, rAllow, { align: 'center', baseline: 'middle' });
  doc.text(allowance.toFixed(2), cAmt, rAllow, { align: 'center', baseline: 'middle' });

  // ── Row 7: EARNINGS Additional Allowance (y = 736..778, midpoint = 757.0) ──
  const rAddl = y(757.0);
  doc.text('Monthly', cDet, rAddl, { align: 'center', baseline: 'middle' });
  doc.text(addlAllow.toFixed(2), cRate, rAddl, { align: 'center', baseline: 'middle' });
  doc.text(addlAllow.toFixed(2), cAmt, rAddl, { align: 'center', baseline: 'middle' });

  // ── Row 8: EARNINGS Overtime ( __ Hrs ) (y = 778..821, midpoint = 799.5) ──
  // In the first column: parenthesis gap is x = 240..303 -> center = 271.5 px
  const rOtE = y(799.5);
  doc.text(`${otHrs.toFixed(1)}`, x(271.5), rOtE, { align: 'center', baseline: 'middle' });
  doc.text(`${otHrs.toFixed(1)} hrs`, cDet, rOtE, { align: 'center', baseline: 'middle' });
  doc.text(`${otRate.toFixed(2)} /hr`, cRate, rOtE, { align: 'center', baseline: 'middle' });
  doc.text(otPay.toFixed(2), cAmt, rOtE, { align: 'center', baseline: 'middle' });

  // ── Row 10: DEDUCTIONS Deduction (y = 865..912, midpoint = 888.5) ──
  const rDed = y(888.5);
  doc.text('–', cDet, rDed, { align: 'center', baseline: 'middle' });
  doc.text('–', cRate, rDed, { align: 'center', baseline: 'middle' });
  doc.text('0.00', cAmt, rDed, { align: 'center', baseline: 'middle' });

  // ── 4. Summary Bar (vertical midpoint of space below labels = 1023.5 px) ──
  // Label centers: Total Earnings = 214.5 px, Total Deductions = 560.5 px, Net Salary = 849.5 px
  const rSum = y(1023.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`AED ${totalEarnings.toFixed(2)}`, x(214.5), rSum, { align: 'center', baseline: 'middle' });
  doc.text(`AED ${totalDeductions.toFixed(2)}`, x(560.5), rSum, { align: 'center', baseline: 'middle' });
  doc.setFontSize(9.5);
  doc.text(`AED ${netSalary.toFixed(2)}`, x(849.5), rSum, { align: 'center', baseline: 'middle' });

  // ── 5. Amount in Words (pill y = 1085..1125, midpoint = 1105.0) ──
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(numToWords(netSalary), x(295), y(1105.0), { maxWidth: 143, baseline: 'middle' });

  // ── 6. Payment Information (vertical midpoint of space below labels = 1201.5 px) ──
  // Label centers: Paid in = 180.0 px, WPS = 492.5 px, Reference No. = 854.5 px
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  const rPay = y(1201.5);
  doc.text('Cash / WPS', x(180.0), rPay, { align: 'center', baseline: 'middle' });
  doc.text('–', x(492.5), rPay, { align: 'center', baseline: 'middle' });
  doc.text('–', x(854.5), rPay, { align: 'center', baseline: 'middle' });
}

async function downloadAllPayslips(workers, monthNum, year, mp) {
  const tplImg = await loadPayslipTemplate();
  const doc = new jsPDF();
  workers.forEach((w, i) => generatePayslipPage(doc, w, monthNum, year, mp, i === 0, tplImg));
  const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const mName = mp === 1 ? (MONTHS[Number(monthNum)] || monthNum) : monthNum;
  doc.save(`Payslips_All_${mName}_${year}.pdf`);
}

async function downloadSinglePayslip(w, monthNum, year, mp) {
  const tplImg = await loadPayslipTemplate();
  const doc = new jsPDF();
  generatePayslipPage(doc, w, monthNum, year, mp, true, tplImg);
  const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const mName = mp === 1 ? (MONTHS[Number(monthNum)] || monthNum) : monthNum;
  doc.save(`Payslip_${w.name.replace(/\s+/g, '_')}_${mName}_${year}.pdf`);
}

const WORKER_REPORT_COLS = ['#', 'Worker', 'ID', 'Department', 'Type', 'Site (most freq.)', 'Experience', 'Present', 'Late', 'Absent', 'No Work', 'ML', 'Annual', 'Emer.', 'Work', 'Casual', 'Unpaid', 'Unspec.', 'Avg %'];

function downloadWorkersReport(fmt, sortedRows, period, year, filterLabel) {
  const tag = filterLabel === 'All' ? 'All' : filterLabel === 'Workers' ? 'Workers' : 'ExtWorkers';
  const fname = `Workers_Attendance_${tag}_${period}_${year}`;
  const rows = (sortedRows || []).map((r, idx) => [
    idx + 1,
    r.name,
    r.id,
    r.department || '–',
    r.worker_type === 'contract' ? 'Contract' : 'Company',
    r.primarySite || '–',
    formatExperience(r.doj, r.worker_type, r.department),
    r.presentDays ?? 0,
    r.lateDays || 0,
    r.absentDays ?? 0,
    r.noWorkDays || 0,
    r.ml || 0,
    r.annual || 0,
    r.emergency || 0,
    r.workRelated || 0,
    r.casual || 0,
    r.unpaid || 0,
    r.unspecified || 0,
    r.pct != null ? `${r.pct}%` : '–',
  ]);

  const totals = [
    '',
    `Total (${rows.length})`,
    '',
    '',
    '',
    '',
    '',
    (sortedRows || []).reduce((s, r) => s + (r.presentDays || 0), 0),
    (sortedRows || []).reduce((s, r) => s + (r.lateDays || 0), 0),
    (sortedRows || []).reduce((s, r) => s + (r.absentDays || 0), 0),
    (sortedRows || []).reduce((s, r) => s + (r.noWorkDays || 0), 0),
    (sortedRows || []).reduce((s, r) => s + (r.ml || 0), 0),
    (sortedRows || []).reduce((s, r) => s + (r.annual || 0), 0),
    (sortedRows || []).reduce((s, r) => s + (r.emergency || 0), 0),
    (sortedRows || []).reduce((s, r) => s + (r.workRelated || 0), 0),
    (sortedRows || []).reduce((s, r) => s + (r.casual || 0), 0),
    (sortedRows || []).reduce((s, r) => s + (r.unpaid || 0), 0),
    (sortedRows || []).reduce((s, r) => s + (r.unspecified || 0), 0),
    '',
  ];

  if (fmt === 'pdf') {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`Workers Attendance Report — ${tag} — ${period} ${year}`, 14, 16);
    autoTable(doc, {
      head: [WORKER_REPORT_COLS],
      body: rows,
      foot: [totals],
      startY: 22,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    });
    doc.save(`${fname}.pdf`);
  } else if (fmt === 'csv') {
    const lines = [
      WORKER_REPORT_COLS.join(','),
      ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')),
      totals.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fname}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else {
    const ws = XLSX.utils.aoa_to_sheet([WORKER_REPORT_COLS, ...rows, totals]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workers Attendance');
    XLSX.writeFile(wb, `${fname}.xlsx`);
  }
}

export default function Admin({ me, onSignOut }) {
  const { dark, toggleTheme } = useTheme();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [holidays, setHolidays] = useState([]);
  const [holErr, setHolErr] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [empTypeFilter, setEmpTypeFilter] = useState('all');
  const [lanyardActive, setLanyardActive] = useState(0);
  const [lanyardFlipped, setLanyardFlipped] = useState(null);
  const [editingWorker, setEditingWorker] = useState(null);
  const [addingWorker, setAddingWorker] = useState(false);
  const [supCanAdd, setSupCanAdd] = useState(false);
  const [supCanAddLoading, setSupCanAddLoading] = useState(true);
  const [payMonth, setPayMonth] = useState(() => String(now.getMonth() + 1));
  const [payYear, setPayYear] = useState(() => String(now.getFullYear()));
  const [paySearch, setPaySearch] = useState('');
  const [payTypeFilter, setPayTypeFilter] = useState('all');
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    Promise.all([
      api.overview(year, month, todayStr()),
      api.holidays(year).catch(() => ({ holidays: [] })),
    ]).then(([d, h]) => {
      if (!alive) return;
      setData(d);
      setHolidays(h.holidays || []);
    }).catch((e) => setErr(e.message));
    return () => { alive = false; };
  }, [year, month]);

  const handleSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir(key === 'name' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  useEffect(() => {
    api.getSetting('supervisor_can_add_workers')
      .then(d => { setSupCanAdd(d.value === 'true'); setSupCanAddLoading(false); })
      .catch(() => setSupCanAddLoading(false));
  }, []);

  async function toggleSupAdd() {
    const newVal = !supCanAdd;
    setSupCanAdd(newVal);
    try { await api.updateSetting('supervisor_can_add_workers', String(newVal)); }
    catch { setSupCanAdd(!newVal); }
  }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setSearch('');
        setDeptFilter('All');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const period = month ? `${year}-${month}` : year;
  const csvHref = `/api/admin/report/all.csv?year=${year}${month ? `&month=${month}` : ''}`;
  const monthlyAvg = data?.overall?.pct;

  const companyCount = data?.rows ? data.rows.filter((r) => r.worker_type === 'company' || (r.worker_type !== 'contract' && r.department !== 'Ext. Manpower')).length : 0;
  const extCount = data?.rows ? data.rows.filter((r) => r.worker_type === 'contract' || r.department === 'Ext. Manpower').length : 0;

  let filtered = data?.rows || [];
  if (deptFilter === 'Workers') {
    filtered = filtered.filter((r) => r.worker_type === 'company' || (r.worker_type !== 'contract' && r.department !== 'Ext. Manpower'));
  } else if (deptFilter === 'Ext. Workers') {
    filtered = filtered.filter((r) => r.worker_type === 'contract' || r.department === 'Ext. Manpower');
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((r) =>
      r.name.toLowerCase().includes(q) || (r.department || '').toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  }

  const sorted = [...filtered].sort((a, b) => {
    let va, vb;
    switch (sortKey) {
      case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
      case 'experience':
      case 'doj': {
        const getExpVal = (w) => {
          if (!w.doj || w.worker_type === 'contract' || w.department === 'Ext. Manpower') return 0;
          return new Date(w.doj).getTime() || 0;
        };
        va = getExpVal(a);
        vb = getExpVal(b);
        if (va === 0 && vb === 0) return 0;
        if (va === 0) return 1;
        if (vb === 0) return -1;
        return sortDir === 'asc' ? vb - va : va - vb;
      }
      case 'presentDays': va = a.presentDays; vb = b.presentDays; break;
      case 'lateDays': va = a.lateDays; vb = b.lateDays; break;
      case 'absentDays': va = a.absentDays; vb = b.absentDays; break;
      case 'pct': va = a.pct ?? -1; vb = b.pct ?? -1; break;
      default: va = a.name.toLowerCase(); vb = b.name.toLowerCase();
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortTh = ({ colKey, label, className }) => (
    <th className={`sort-th ${className || ''}`} onClick={() => handleSort(colKey)}>
      {label}
      {sortKey === colKey && <span className="sort-arrow">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>}
    </th>
  );

  const rowsSource = (data?.rows && data.rows.length > 0) ? data.rows : DEFAULT_16_WORKERS;
  const lanyardMembers = rowsSource.map((r, idx) => {
    const tone = (((idx % 5) + 1));
    const isContract = r.worker_type === 'contract';
    const roleTitle = r.designation || (isContract ? 'External Contractor' : 'Company Staff');
    const dept = r.department || 'Operations';
    const presentDays = r.presentDays ?? 0;
    const dutyHrs = Number(r.totalDutyHours || 0).toFixed(0);
    const otHrs = Number(r.totalOvertimeHours || 0).toFixed(0);
    const totalWage = Math.round(r.totalWage || 0);

    return {
      id: String(r.id),
      name: r.name,
      role: roleTitle,
      team: `${dept} · ID: ${r.id}`,
      tone,
      image: '',
      bio: `${r.name} has recorded ${presentDays} days on duty (${dutyHrs}h regular + ${otHrs}h OT) with AED ${totalWage.toLocaleString()} total wages earned this cycle.`,
      tags: [
        isContract ? 'Contractor' : 'Company Staff',
        dept,
        `${presentDays} Days Present`,
        isContract ? `AED ${r.duty_rate_hr || 8.5}/hr` : 'Monthly Salaried',
      ],
      links: [
        { label: 'View Track Record →', href: `/admin/worker/${r.id}` },
        { label: 'View Profile', href: `/admin/worker/${r.id}` },
      ],
    };
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page dash-premium ad-page">
      <div className="dash-bg" aria-hidden="true">
        <GlassFold
          color1="#1e3cc8"
          color2="#06081e"
          color3="#96d7ff"
          speed={0.4}
          scale={1}
          noise={0.08}
          className="dash-canvas"
        />
        <div className="grid-bg" />
        <div className="ad-orb ad-orb-1" />
        <div className="ad-orb ad-orb-2" />
        <div className="ad-orb ad-orb-3" />
        <div className="ad-orb ad-orb-4" />
        <div className="ad-orb ad-orb-5" />
        <div className="ad-orb ad-orb-6" />
      </div>

      {/* Top-Right Portal Actions: Theme Toggle & Sign Out */}
      <div className="top-right-bar">
        <button
          className="top-theme-btn"
          onClick={toggleTheme}
          title={dark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          aria-label={dark ? 'Switch to Light mode' : 'Switch to Dark mode'}
        >
          {dark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button className="top-signout-btn" onClick={onSignOut} title="Sign out of portal">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Sign out</span>
        </button>
      </div>

      {/* Liquid Glass Navigation Bar (Waterline) - Top & Centered */}
      <div className="admin-liquid-nav-container">
        <LiquidNavbar
          tone="dark"
          active={Math.max(0, ADMIN_NAV_KEYS.indexOf(activeTab))}
          onChange={(index) => setActiveTab(ADMIN_NAV_KEYS[index])}
          items={ADMIN_NAV_ITEMS}
          sound={true}
          className="admin-liquid-nav"
        />
      </div>

      {activeTab === 'dashboard' && <>
      {/* Welcome section */}
      <div className="ad-welcome">
        <h1 className="ad-greeting">{greeting}, <span className="gradient-text">Admin</span></h1>
        <p className="ad-period">Viewing {monthName(month) || 'Full year'} {year}</p>
      </div>

      {/* Bento stat cards */}
      <div className="ad-stats">
        <div className="ad-stat">
          <div className="ad-stat-icon">👥</div>
          <div className="ad-stat-body">
            <div className="ad-stat-num">{data?.todayStats ? <>{data.todayStats.present}<span>/{data.todayStats.totalWorkers}</span></> : '…'}</div>
            <div className="ad-stat-label">
              Present today
              {data?.todayStats && (
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.88, display: 'flex', gap: '8px', flexWrap: 'wrap', fontWeight: 600 }}>
                  <span>Late: <strong style={{ color: '#F59E0B' }}>{data.todayStats.late || 0}</strong></span>
                  <span>Absent: <strong style={{ color: '#EF4444' }}>{data.todayStats.absent || 0}</strong></span>
                  <span>No Work: <strong style={{ color: '#94A3B8' }}>{data.todayStats.noWork || 0}</strong></span>
                </div>
              )}
            </div>
          </div>
          <Ring value={data?.todayStats?.present || 0} max={data?.todayStats?.totalWorkers || 1} color="#62C8E6" trackColor="rgba(255,255,255,0.1)" />
        </div>
        <div className="ad-stat ad-stat-accent">
          <div className="ad-stat-icon">📊</div>
          <div className="ad-stat-body">
            <div className="ad-stat-num">{monthlyAvg != null ? <>{monthlyAvg}<span>%</span></> : '—'}</div>
            <div className="ad-stat-label">Attendance avg · {period}</div>
          </div>
          <Ring value={monthlyAvg ?? 0} max={100} color="#62C8E6" trackColor="rgba(255,255,255,0.1)" />
        </div>
        <div className="ad-stat ad-stat-warn">
          <div className="ad-stat-icon">🏥</div>
          <div className="ad-stat-body">
            <div className="ad-stat-num">{sumCol(data, 'ml')}<span>d</span></div>
            <div className="ad-stat-label">ML days · {period}</div>
          </div>
        </div>
        <div className="ad-stat ad-stat-orange">
          <div className="ad-stat-icon">🚨</div>
          <div className="ad-stat-body">
            <div className="ad-stat-num">{sumCol(data, 'emergency')}<span>d</span></div>
            <div className="ad-stat-label">Emergency days · {period}</div>
          </div>
        </div>
      </div>

      <ShiftConfigManager />

      {/* Worker table card with shiny borders realism wrapper */}
      <div className="ad-card-wrapper">
        <div className="ad-card-border-glow" aria-hidden="true" />
        <div className="ad-card">
          <div className="ad-card-shine-line" aria-hidden="true" />
          <div className="ad-card-corner-blob" aria-hidden="true" />
          <div className="ad-card-head">
            <div>
              <h2 className="ad-card-title">Workers · {monthName(month) || 'Year'} {year}</h2>
              <p className="ad-card-sub">Click a worker for their full track record, calendar and individual report.</p>
            </div>
            <div className="ad-header-actions" style={{ marginLeft: 'auto', flexWrap: 'wrap' }}>
              <select className="ad-select" value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">Whole year</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  return <option key={m} value={m}>{monthName(m)}</option>;
                })}
              </select>
              <select className="ad-select" value={year} onChange={(e) => setYear(e.target.value)}>
                {years().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <div className="ad-export-btns" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {[
                  { label: 'PDF', cls: 'ad-btn-export-pdf', fn: () => downloadWorkersReport('pdf', sorted, monthName(month) || 'Year', year, deptFilter) },
                  { label: 'CSV', cls: 'ad-btn-export-csv', fn: () => downloadWorkersReport('csv', sorted, monthName(month) || 'Year', year, deptFilter) },
                  { label: 'Excel', cls: 'ad-btn-export-xlsx', fn: () => downloadWorkersReport('xlsx', sorted, monthName(month) || 'Year', year, deptFilter) },
                ].map(b => (
                  <button key={b.label} className={`ad-btn ${b.cls}`} style={{ fontSize: 12, padding: '7px 14px' }} onClick={b.fn}>{b.label}</button>
                ))}
              </div>
            </div>
          </div>

          {data?.rows && data.rows.length > 0 && (
            <div className="ad-chips">
              <button className={`ad-chip${deptFilter === 'All' ? ' active' : ''}`} onClick={() => setDeptFilter('All')}>All ({data.rows.length})</button>
              <button className={`ad-chip${deptFilter === 'Workers' ? ' active' : ''}`} onClick={() => setDeptFilter('Workers')}>Workers ({companyCount})</button>
              <button className={`ad-chip${deptFilter === 'Ext. Workers' ? ' active' : ''}`} onClick={() => setDeptFilter('Ext. Workers')}>Ext. Workers ({extCount})</button>
            </div>
          )}

          {err && <div className="error-msg">{err}</div>}
          {!data && !err ? (
            <div className="admin-skeleton">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-row">
                  <div className="skeleton-cell wide" />
                  <div className="skeleton-cell" />
                  <div className="skeleton-cell" />
                  <div className="skeleton-cell" />
                  <div className="skeleton-cell narrow" />
                </div>
              ))}
            </div>
          ) : data ? (
            <div className="ad-table-container">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="num th-col-id" style={{ width: 44, textAlign: 'center' }}>#</th>
                    <SortTh colKey="name" label="Worker" className="th-col-worker" />
                    <th className="th-col-site">Site (most freq.)</th>
                    <SortTh colKey="experience" label="Experience" className="th-col-exp" style={{ textAlign: 'center' }} />
                    <SortTh colKey="presentDays" label="Present" className="num th-col-present" />
                    <SortTh colKey="lateDays" label="Late" className="num th-col-late" />
                    <SortTh colKey="absentDays" label="Absent" className="num th-col-absent" />
                    <SortTh colKey="noWorkDays" label="No Work" className="num th-col-nowork" />
                    {LEAVE_COLS.map(([k, l]) => <th key={k} className={`num th-col-${k}`}>{l}</th>)}
                    <SortTh colKey="pct" label="Avg %" className="num th-col-avg" />
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, idx) => (
                    <tr key={r.id}>
                      <td className="num">{idx + 1}</td>
                      <td><div className="name">{r.name}</div><div className="dep">{r.department} · {r.id}</div></td>
                      <td className="th-col-site">{r.primarySite ? <span className="site-pill">{r.primarySite}</span> : <span className="exp-dash">—</span>}</td>
                      <td className="th-col-exp" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {r.worker_type === 'contract' || r.department === 'Ext. Manpower' || !r.doj ? (
                          <span className="exp-dash">—</span>
                        ) : (
                          <span className="exp-pill">{formatExperience(r.doj, r.worker_type, r.department)}</span>
                        )}
                      </td>
                      <td className="num">{r.presentDays}</td>
                      <td className="num" style={{ color: r.lateDays ? '#F59E0B' : 'inherit' }}>{r.lateDays || '–'}</td>
                      <td className="num">{r.absentDays}</td>
                      <td className="num" style={{ color: r.noWorkDays ? '#64748B' : 'inherit' }}>{r.noWorkDays || '–'}</td>
                      {LEAVE_COLS.map(([k]) => <td key={k} className="num" style={{ color: r[k] ? '#f0a54c' : 'inherit' }}>{r[k] || '–'}</td>)}
                      <td className="num">{r.pct != null && <span className={`pct ${r.pct < 80 ? 'low' : ''}`}>{r.pct}%</span>}</td>
                      <td><Link className="rowlink" to={`/admin/worker/${r.id}`}>Track record →</Link></td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr><td colSpan={16} className="muted" style={{ textAlign: 'center', padding: 28 }}>{search || deptFilter !== 'All' ? 'No workers match the current filter.' : 'No worker data yet.'}</td></tr>
                  )}
                </tbody>
              </table>
              {sorted.length > 0 && (
                <div className="tbl-note">Showing {sorted.length} of {data.rows.length} workers{deptFilter !== 'All' ? ` in ${deptFilter}` : ''}{search ? ` matching "${search}"` : ''}</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Hanging Team Lanyard Rail / Sliding Card Animation in Dashboard at the very bottom separately */}
      <div style={{ width: '100%', margin: '40px 0 24px 0', position: 'relative' }}>
        <TeamLanyardRail
          items={lanyardMembers}
          autoplay={false}
        />
      </div>

      </>}

      {activeTab === 'employees' && (() => {
        const mp = month ? 1 : 12;
        const allRows = data?.rows || [];
        const eRows = empTypeFilter === 'all' ? allRows
          : empTypeFilter === 'company' ? allRows.filter(r => r.worker_type === 'company')
          : allRows.filter(r => r.worker_type === 'contract');
        const companyCount = allRows.filter(r => r.worker_type === 'company').length;
        const contractCount = allRows.filter(r => r.worker_type === 'contract').length;
        const sumWages = eRows.reduce((s, r) => s + (r.totalWage || 0), 0);
        const sumAdditional = eRows.reduce((s, r) => {
          const totalHrs = (r.totalDutyHours || 0) + (r.totalOvertimeHours || 0);
          return s + ((r.rov_monthly || 0) * mp) + ((r.transport_monthly || 0) * mp) + ((r.other_expense_hr || 0) * totalHrs);
        }, 0);
        const sumTotal = sumWages + sumAdditional;

        return <>
        <div className="ad-stats">
          <div className="ad-stat">
            <div className="ad-stat-icon">👥</div>
            <div className="ad-stat-body">
              <div className="ad-stat-num">{eRows.length}</div>
              <div className="ad-stat-label">Total Workforce</div>
            </div>
          </div>
          <div className="ad-stat">
            <div className="ad-stat-icon">💰</div>
            <div className="ad-stat-body">
              <div className="ad-stat-num ad-stat-num-currency">AED {Math.round(sumWages).toLocaleString()}</div>
              <div className="ad-stat-label">Total Wages · {monthName(month) || year}</div>
            </div>
          </div>
          <div className="ad-stat">
            <div className="ad-stat-icon">🏠</div>
            <div className="ad-stat-body">
              <div className="ad-stat-num ad-stat-num-currency">AED {Math.round(sumAdditional).toLocaleString()}</div>
              <div className="ad-stat-label">Additional Costs · {monthName(month) || year}</div>
            </div>
          </div>
          <div className="ad-stat ad-stat-accent">
            <div className="ad-stat-icon">📋</div>
            <div className="ad-stat-body">
              <div className="ad-stat-num ad-stat-num-currency">AED {Math.round(sumTotal).toLocaleString()}</div>
              <div className="ad-stat-label">Total Company Expense · {monthName(month) || year}</div>
            </div>
          </div>
        </div>

        <div className="ad-card-wrapper">
          <div className="ad-card-border-glow" aria-hidden="true" />
          <div className="ad-card">
            <div className="ad-card-shine-line" aria-hidden="true" />
            <div className="ad-card-corner-blob" aria-hidden="true" />
            <div className="ad-card-head">
              <div>
                <h2 className="ad-card-title">Employee Expense Breakdown — {monthName(month) || 'Year'} {year}</h2>
                <p className="ad-card-sub">Wages, overtime, and additional costs per employee. Room/Office/Visa and Transport are monthly; Other Expense is per working hour.</p>
              </div>
            </div>
            <div className="ad-table-toolbar">
              <div className="ad-chips">
                <button className={`ad-chip${empTypeFilter === 'all' ? ' active' : ''}`} onClick={() => setEmpTypeFilter('all')}>All ({allRows.length})</button>
                <button className={`ad-chip${empTypeFilter === 'company' ? ' active' : ''}`} onClick={() => setEmpTypeFilter('company')}>Company Workers ({companyCount})</button>
                <button className={`ad-chip${empTypeFilter === 'contract' ? ' active' : ''}`} onClick={() => setEmpTypeFilter('contract')}>Ext. Workers ({contractCount})</button>
              </div>
              <div className="ad-toolbar-actions">
                <div className="ad-date-selects">
                  <select className="ad-select" value={month} onChange={(e) => setMonth(e.target.value)}>
                    <option value="">Whole year</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = String(i + 1).padStart(2, '0');
                      return <option key={m} value={m}>{monthName(m)}</option>;
                    })}
                  </select>
                  <select className="ad-select" value={year} onChange={(e) => setYear(e.target.value)}>
                    {years().map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="ad-export-btns" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {[
                    { label: 'PDF', cls: 'ad-btn-export-pdf', fn: () => downloadExpense('pdf', eRows, mp, monthName(month) || 'Year', year, empTypeFilter) },
                    { label: 'CSV', cls: 'ad-btn-export-csv', fn: () => downloadExpense('csv', eRows, mp, monthName(month) || 'Year', year, empTypeFilter) },
                    { label: 'Excel', cls: 'ad-btn-export-xlsx', fn: () => downloadExpense('xlsx', eRows, mp, monthName(month) || 'Year', year, empTypeFilter) },
                  ].map(b => (
                    <button key={b.label} className={`ad-btn ${b.cls}`} style={{ fontSize: 12, padding: '7px 14px' }} onClick={b.fn}>{b.label}</button>
                  ))}
                </div>
              </div>
            </div>
            {!data && !err ? (
              <div className="admin-skeleton">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton-row"><div className="skeleton-cell wide" /><div className="skeleton-cell" /><div className="skeleton-cell" /><div className="skeleton-cell" /></div>
                ))}
              </div>
            ) : data ? (
              <div className="ad-table-container">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="num th-col-id">#</th>
                      <th className="th-col-worker">Worker</th>
                      <th className="th-col-type">Type</th>
                      <th className="th-col-site">Site (most freq.)</th>
                      <th className="th-col-desig">Designation</th>
                      <th className="th-col-exp">Experience</th>
                      <th className="num th-col-present">Present</th>
                      <th className="num th-col-hours">Duty Hrs</th>
                      <th className="num th-col-hours">OT Hrs</th>
                      <th className="num th-col-rate">Duty Pay/Hr</th>
                      <th className="num th-col-rate">OT Pay/Hr</th>
                      <th className="num th-col-wage">Duty Pay</th>
                      <th className="num th-col-wage">OT Pay</th>
                      <th className="num th-col-wage-total">Total Wages</th>
                      <th className="num th-col-overhead">Room/Office/Visa</th>
                      <th className="num th-col-overhead">Transport</th>
                      <th className="num th-col-overhead">Other Expense</th>
                      <th className="num th-col-overhead">Addl. Allowance</th>
                      <th className="num th-col-cost-total">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eRows.map((r, idx) => {
                      const rov = (r.rov_monthly || 0) * mp;
                      const trans = (r.transport_monthly || 0) * mp;
                      const totalHrs = (r.totalDutyHours || 0) + (r.totalOvertimeHours || 0);
                      const otherExp = Math.round((r.other_expense_hr || 0) * totalHrs * 100) / 100;
                      const addlAllow = (r.additional_allowance || 0) * mp;
                      const totalCost = Math.round(((r.totalWage || 0) + rov + trans + otherExp + addlAllow) * 100) / 100;
                      const dutyPayHr = r.totalDutyHours > 0 ? ((r.totalDailyWage || 0) / r.totalDutyHours) : Number(r.duty_rate_hr || 0);
                      const otPayHr = r.totalOvertimeHours > 0 ? ((r.totalOvertimeWage || 0) / r.totalOvertimeHours) : Number(r.ot_rate || 0);
                      return (
                        <tr key={r.id}>
                          <td className="num">{idx + 1}</td>
                          <td><div className="name">{r.name}</div><div className="dep">{r.department} · {r.id}</div></td>
                          <td>{r.worker_type === 'contract' ? 'Contract' : 'Company'}</td>
                          <td className="th-col-site">{r.primarySite ? <span className="site-pill">{r.primarySite}</span> : <span className="exp-dash">—</span>}</td>
                          <td>{r.designation || '–'}</td>
                          <td className="th-col-exp" style={{ whiteSpace: 'nowrap' }}>
                            {r.worker_type === 'contract' || r.department === 'Ext. Manpower' || !r.doj ? (
                              <span className="exp-dash">—</span>
                            ) : (
                              <span className="exp-pill">{formatExperience(r.doj, r.worker_type, r.department)}</span>
                            )}
                          </td>
                          <td className="num">{r.presentDays}</td>
                          <td className="num">{r.totalDutyHours ? r.totalDutyHours.toFixed(1) : '–'}</td>
                          <td className="num">{r.totalOvertimeHours ? r.totalOvertimeHours.toFixed(1) : '–'}</td>
                          <td className="num">{dutyPayHr ? dutyPayHr.toFixed(2) : '–'}</td>
                          <td className="num">{otPayHr ? otPayHr.toFixed(2) : '–'}</td>
                          <td className="num">{r.totalDailyWage ? r.totalDailyWage.toLocaleString() : '–'}</td>
                          <td className="num">{r.totalOvertimeWage ? r.totalOvertimeWage.toLocaleString() : '–'}</td>
                          <td className="num"><strong>{r.totalWage ? r.totalWage.toLocaleString() : '–'}</strong></td>
                          <td className="num">{rov ? rov.toLocaleString() : '–'}</td>
                          <td className="num">{trans ? trans.toLocaleString() : '–'}</td>
                          <td className="num">{otherExp ? otherExp.toLocaleString() : '–'}</td>
                          <td className="num">{addlAllow ? addlAllow.toLocaleString() : '–'}</td>
                          <td className="num"><strong>{totalCost ? totalCost.toLocaleString() : '–'}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {eRows.length > 0 && (
                    <tfoot>
                      <tr style={{ fontWeight: 700 }}>
                        <td className="th-col-id"></td>
                        <td className="th-col-worker">Total ({eRows.length} workers)</td>
                        <td className="th-col-type"></td>
                        <td className="th-col-desig"></td>
                        <td className="th-col-exp"></td>
                        <td className="num th-col-present">{eRows.reduce((s, r) => s + (r.presentDays || 0), 0)}</td>
                        <td className="num th-col-hours">{eRows.reduce((s, r) => s + (r.totalDutyHours || 0), 0).toFixed(1)}</td>
                        <td className="num th-col-hours">{eRows.reduce((s, r) => s + (r.totalOvertimeHours || 0), 0).toFixed(1)}</td>
                        <td className="num th-col-rate">–</td>
                        <td className="num th-col-rate">–</td>
                        <td className="num th-col-wage">{Math.round(eRows.reduce((s, r) => s + (r.totalDailyWage || 0), 0)).toLocaleString()}</td>
                        <td className="num th-col-wage">{Math.round(eRows.reduce((s, r) => s + (r.totalOvertimeWage || 0), 0)).toLocaleString()}</td>
                        <td className="num th-col-wage-total"><strong>{Math.round(sumWages).toLocaleString()}</strong></td>
                        <td className="num th-col-overhead">{(eRows.reduce((s, r) => s + (r.rov_monthly || 0), 0) * mp).toLocaleString()}</td>
                        <td className="num th-col-overhead">{(eRows.reduce((s, r) => s + (r.transport_monthly || 0), 0) * mp).toLocaleString()}</td>
                        <td className="num th-col-overhead">{Math.round(eRows.reduce((s, r) => s + (r.other_expense_hr || 0) * ((r.totalDutyHours || 0) + (r.totalOvertimeHours || 0)), 0)).toLocaleString()}</td>
                        <td className="num th-col-overhead">{(eRows.reduce((s, r) => s + (r.additional_allowance || 0), 0) * mp).toLocaleString()}</td>
                        <td className="num th-col-cost-total"><strong>{Math.round(eRows.reduce((s, r) => { const th = (r.totalDutyHours||0)+(r.totalOvertimeHours||0); return s + (r.totalWage||0) + (r.rov_monthly||0)*mp + (r.transport_monthly||0)*mp + (r.other_expense_hr||0)*th + (r.additional_allowance||0)*mp; }, 0)).toLocaleString()}</strong></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : null}
          </div>
        </div>
        </>;
      })()}

      {activeTab === 'payroll' && (() => {
        const allWorkers = (data?.rows && data.rows.length > 0) ? data.rows : DEFAULT_16_WORKERS;

        const companyCount = allWorkers.filter(w => w.worker_type === 'company' || (w.worker_type !== 'contract' && w.department !== 'Ext. Manpower')).length;
        const contractCount = allWorkers.filter(w => w.worker_type === 'contract' || w.department === 'Ext. Manpower').length;

        let filtered = allWorkers;
        if (payTypeFilter === 'company') {
          filtered = filtered.filter(w => w.worker_type === 'company' || (w.worker_type !== 'contract' && w.department !== 'Ext. Manpower'));
        } else if (payTypeFilter === 'contract') {
          filtered = filtered.filter(w => w.worker_type === 'contract' || w.department === 'Ext. Manpower');
        }

        if (paySearch.trim()) {
          const q = paySearch.toLowerCase().trim();
          filtered = filtered.filter(w =>
            (w.name || '').toLowerCase().includes(q) ||
            (w.designation || '').toLowerCase().includes(q) ||
            (w.department || '').toLowerCase().includes(q) ||
            (w.id || '').toLowerCase().includes(q)
          );
        }

        // Global stats across all workers on payroll for current period
        let sumTotalDisbursed = 0;
        let sumTotalDutyHrs = 0;
        let sumTotalOtHrs = 0;
        let sumTotalOtPay = 0;

        allWorkers.forEach(w => {
          const isContract = w.worker_type === 'contract';
          const dutyPay = w.totalDailyWage || 0;
          const otPay = w.totalOvertimeWage || 0;
          const addlAllow = Number(w.additional_allowance || 0);
          const allowance = Number(w.allowance || 0);
          const basic = Number(w.basic_salary || 0);
          const totalPay = isContract
            ? dutyPay + otPay + addlAllow
            : basic + allowance + addlAllow + otPay;
          sumTotalDisbursed += totalPay;
          sumTotalDutyHrs += (w.totalDutyHours || 0);
          sumTotalOtHrs += (w.totalOvertimeHours || 0);
          sumTotalOtPay += otPay;
        });

        // Totals for filtered table in tfoot
        let footDutyHrs = 0;
        let footOtHrs = 0;
        let footBasePay = 0;
        let footOtPay = 0;
        let footTotalPay = 0;

        filtered.forEach(w => {
          const isContract = w.worker_type === 'contract';
          const dutyPay = w.totalDailyWage || 0;
          const otPay = w.totalOvertimeWage || 0;
          const addlAllow = Number(w.additional_allowance || 0);
          const allowance = Number(w.allowance || 0);
          const basic = Number(w.basic_salary || 0);
          const basePay = isContract ? dutyPay : basic;
          const totalPay = isContract
            ? dutyPay + otPay + addlAllow
            : basic + allowance + addlAllow + otPay;
          footDutyHrs += (w.totalDutyHours || 0);
          footOtHrs += (w.totalOvertimeHours || 0);
          footBasePay += basePay;
          footOtPay += otPay;
          footTotalPay += totalPay;
        });

        return (
          <>
            {/* Bento stat cards matching other tabs */}
            <div className="ad-stats">
              <div className="ad-stat ad-stat-accent">
                <div className="ad-stat-icon">💳</div>
                <div className="ad-stat-body">
                  <div className="ad-stat-num ad-stat-num-currency">
                    AED {Math.round(sumTotalDisbursed).toLocaleString()}
                  </div>
                  <div className="ad-stat-label">Total Payroll · {monthName(payMonth)} {payYear}</div>
                </div>
              </div>

              <div className="ad-stat">
                <div className="ad-stat-icon">👥</div>
                <div className="ad-stat-body">
                  <div className="ad-stat-num">{allWorkers.length}</div>
                  <div className="ad-stat-label">Workforce on Payroll</div>
                </div>
              </div>

              <div className="ad-stat">
                <div className="ad-stat-icon">⏱️</div>
                <div className="ad-stat-body">
                  <div className="ad-stat-num">{sumTotalDutyHrs.toFixed(1)}<span>hrs</span></div>
                  <div className="ad-stat-label">Regular Duty Hours</div>
                </div>
              </div>

              <div className="ad-stat ad-stat-orange">
                <div className="ad-stat-icon">⚡</div>
                <div className="ad-stat-body">
                  <div className="ad-stat-num">{sumTotalOtHrs.toFixed(1)}<span>hrs</span></div>
                  <div className="ad-stat-label">Overtime (AED {Math.round(sumTotalOtPay).toLocaleString()})</div>
                </div>
              </div>
            </div>

            {/* Payroll Card Wrapper with polished glowing glass border */}
            <div className="ad-card-wrapper">
              <div className="ad-card-border-glow" aria-hidden="true" />
              <div className="ad-card">
                <div className="ad-card-shine-line" aria-hidden="true" />
                <div className="ad-card-corner-blob" aria-hidden="true" />

                <div className="ad-card-head">
                  <div>
                    <h2 className="ad-card-title">Payroll — {monthName(payMonth)} {payYear}</h2>
                    <p className="ad-card-sub">Generate and download individual or batch employee payslips, track duty wages, overtime, and allowances.</p>
                  </div>

                  <div className="ad-header-actions" style={{ marginLeft: 'auto', flexWrap: 'wrap' }}>
                    <div className="ad-date-selects">
                      <select
                        className="ad-select"
                        value={Number(payMonth)}
                        onChange={e => {
                          const m = e.target.value;
                          setPayMonth(m);
                          setMonth(String(m).padStart(2, '0'));
                        }}
                      >
                        {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                          <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                      </select>
                      <select
                        className="ad-select"
                        value={payYear}
                        onChange={e => {
                          const y = e.target.value;
                          setPayYear(y);
                          setYear(String(y));
                        }}
                      >
                        {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    <div className="ad-export-btns" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        className="ad-btn ad-btn-export-pdf"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 14px' }}
                        disabled={downloadingAll || !filtered.length}
                        onClick={async () => {
                          if (!filtered.length || downloadingAll) return;
                          setDownloadingAll(true);
                          try {
                            await downloadAllPayslips(filtered, payMonth, payYear, 1);
                          } finally {
                            setDownloadingAll(false);
                          }
                        }}
                        title="Download A4 Payslip PDF batch for all visible employees"
                      >
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>{downloadingAll ? 'Generating PDFs...' : 'All Payslips (PDF)'}</span>
                      </button>

                      <button
                        className="ad-btn ad-btn-export-xlsx"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 14px' }}
                        onClick={() => downloadPayrollReport('xlsx', filtered, monthName(payMonth), payYear, payTypeFilter)}
                        title="Export payroll table to Excel"
                      >
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                        <span>Excel</span>
                      </button>

                      <button
                        className="ad-btn ad-btn-export-csv"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 14px' }}
                        onClick={() => downloadPayrollReport('csv', filtered, monthName(payMonth), payYear, payTypeFilter)}
                        title="Export payroll table to CSV"
                      >
                        CSV
                      </button>
                    </div>
                  </div>
                </div>

                <div className="ad-table-toolbar">
                  <div className="ad-chips">
                    <button
                      className={`ad-chip${payTypeFilter === 'all' ? ' active' : ''}`}
                      onClick={() => setPayTypeFilter('all')}
                    >
                      All ({allWorkers.length})
                    </button>
                    <button
                      className={`ad-chip${payTypeFilter === 'company' ? ' active' : ''}`}
                      onClick={() => setPayTypeFilter('company')}
                    >
                      Company Workers ({companyCount})
                    </button>
                    <button
                      className={`ad-chip${payTypeFilter === 'contract' ? ' active' : ''}`}
                      onClick={() => setPayTypeFilter('contract')}
                    >
                      Ext. Workers ({contractCount})
                    </button>
                  </div>

                  <div className="ad-toolbar-actions">
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        style={{ position: 'absolute', left: 12, opacity: 0.5, pointerEvents: 'none' }}
                      >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        className="ad-input"
                        placeholder="Search employee, designation, ID..."
                        value={paySearch}
                        onChange={e => setPaySearch(e.target.value)}
                        style={{ paddingLeft: 34, width: 280 }}
                      />
                      {paySearch && (
                        <button
                          onClick={() => setPaySearch('')}
                          style={{
                            position: 'absolute',
                            right: 10,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            opacity: 0.6,
                            padding: 2,
                            display: 'flex',
                          }}
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {!data && !err ? (
                  <div className="admin-skeleton">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="skeleton-row">
                        <div className="skeleton-cell wide" />
                        <div className="skeleton-cell" />
                        <div className="skeleton-cell" />
                        <div className="skeleton-cell" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ad-table-container">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th className="num th-col-id" style={{ width: 44, textAlign: 'center' }}>#</th>
                          <th className="th-col-worker">Employee</th>
                          <th className="th-col-desig">Designation</th>
                          <th className="th-col-type">Type</th>
                          <th className="num th-col-hours">Duty Hrs</th>
                          <th className="num th-col-hours">OT Hrs</th>
                          <th className="num th-col-wage">Base Pay</th>
                          <th className="num th-col-wage">OT Pay</th>
                          <th className="num th-col-wage-total">Net Pay (AED)</th>
                          <th style={{ width: 130, textAlign: 'center' }}>Payslip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((w, idx) => {
                          const isContract = w.worker_type === 'contract';
                          const dutyPay = w.totalDailyWage || 0;
                          const otPay = w.totalOvertimeWage || 0;
                          const addlAllow = Number(w.additional_allowance || 0);
                          const allowance = Number(w.allowance || 0);
                          const basic = Number(w.basic_salary || 0);
                          const basePay = isContract ? dutyPay : basic;
                          const totalPay = isContract
                            ? dutyPay + otPay + addlAllow
                            : basic + allowance + addlAllow + otPay;

                          return (
                            <tr key={w.id || idx}>
                              <td className="num">{idx + 1}</td>
                              <td>
                                <div className="name">{w.name}</div>
                                <div className="dep">{w.department || '–'} · {w.id}</div>
                              </td>
                              <td>{w.designation || '–'}</td>
                              <td>
                                <span className={`worker-type-badge ${isContract ? 'contract' : 'company'}`}>
                                  {isContract ? 'Contract' : 'Company'}
                                </span>
                              </td>
                              <td className="num">{(w.totalDutyHours || 0).toFixed(1)}</td>
                              <td className="num">
                                {(w.totalOvertimeHours || 0) > 0 ? (
                                  <span style={{ color: '#F59E0B', fontWeight: 600 }}>{(w.totalOvertimeHours).toFixed(1)}</span>
                                ) : (
                                  '–'
                                )}
                              </td>
                              <td className="num">{Math.round(basePay).toLocaleString()}</td>
                              <td className="num">
                                {Math.round(otPay) > 0 ? (
                                  <span style={{ color: '#F59E0B' }}>{Math.round(otPay).toLocaleString()}</span>
                                ) : (
                                  '–'
                                )}
                              </td>
                              <td className="num">
                                <strong>AED {totalPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="ad-btn ad-btn-primary"
                                  style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                  onClick={() => downloadSinglePayslip(w, payMonth, payYear, 1)}
                                  title={`Download A4 payslip PDF for ${w.name}`}
                                >
                                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  <span>Payslip</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={10} className="muted" style={{ textAlign: 'center', padding: '36px 12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.7 }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <circle cx="11" cy="11" r="8" />
                                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <div>No employees found matching {paySearch ? `"${paySearch}"` : 'the selected filter'}.</div>
                                {paySearch && (
                                  <button
                                    className="ad-btn"
                                    style={{ fontSize: 12, marginTop: 4, padding: '4px 12px' }}
                                    onClick={() => setPaySearch('')}
                                  >
                                    Clear search filter
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {filtered.length > 0 && (
                        <tfoot>
                          <tr style={{ fontWeight: 700 }}>
                            <td className="th-col-id"></td>
                            <td className="th-col-worker">Total ({filtered.length} employees)</td>
                            <td className="th-col-desig"></td>
                            <td className="th-col-type"></td>
                            <td className="num th-col-hours">{footDutyHrs.toFixed(1)}</td>
                            <td className="num th-col-hours">{footOtHrs.toFixed(1)}</td>
                            <td className="num th-col-wage">AED {Math.round(footBasePay).toLocaleString()}</td>
                            <td className="num th-col-wage">AED {Math.round(footOtPay).toLocaleString()}</td>
                            <td className="num th-col-wage-total">
                              <strong>AED {footTotalPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                    {filtered.length > 0 && (
                      <div className="tbl-note">
                        Showing {filtered.length} of {allWorkers.length} employees
                        {payTypeFilter !== 'all' ? ` (${payTypeFilter === 'company' ? 'Company Workers' : 'External Manpower'})` : ''}
                        {paySearch ? ` matching "${paySearch}"` : ''} · Currency: AED
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {activeTab === 'manage' && (
        <>
        <div className="ad-card-wrapper">
          <div className="ad-card-border-glow" aria-hidden="true" />
          <div className="ad-card">
            <div className="ad-card-shine-line" aria-hidden="true" />
            <div className="ad-card-corner-blob" aria-hidden="true" />
            <div className="ad-card-head">
              <div>
                <h2 className="ad-card-title">Manage Workers</h2>
                <p className="ad-card-sub">View and edit employee details, salary information, and expense allocations.</p>
              </div>
              <button className="ad-btn ad-btn-primary" onClick={() => setAddingWorker(true)}>
                <span className="ad-btn-primary-inner">+ Add Worker</span>
              </button>
            </div>
            <div className="toggle-row">
              <label className="toggle-switch">
                <input type="checkbox" checked={supCanAdd} onChange={toggleSupAdd} disabled={supCanAddLoading} />
                <span className="toggle-slider" />
              </label>
              <span>Allow supervisors to add workers</span>
            </div>
            {!data ? (
              <div className="admin-skeleton">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton-row"><div className="skeleton-cell wide" /><div className="skeleton-cell" /><div className="skeleton-cell" /></div>
                ))}
              </div>
            ) : (
              <div className="ad-table-container">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="num th-col-id" style={{ width: 44, textAlign: 'center' }}>#</th>
                      <th className="th-col-name">Name</th>
                      <th className="th-col-id">ID</th>
                      <th className="th-col-worker">Department</th>
                      <th className="th-col-type">Type</th>
                      <th className="th-col-desig">Designation</th>
                      <th className="th-col-doj">DOJ</th>
                      <th className="th-col-exp">Experience</th>
                      <th className="num th-col-wage">Basic</th>
                      <th className="num th-col-wage">Allowance</th>
                      <th className="num th-col-hours">Duty Rate/hr</th>
                      <th className="num th-col-hours">OT Rate/hr</th>
                      <th className="num th-col-overhead">ROV/mo</th>
                      <th className="num th-col-overhead">Transport/mo</th>
                      <th className="num th-col-overhead">Other Exp/hr</th>
                      <th className="num th-col-overhead">Addl. Allow/mo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.rows || []).map((w, idx) => (
                      <tr key={w.id}>
                        <td className="num">{idx + 1}</td>
                        <td><strong>{w.name}</strong></td>
                        <td>{w.id}</td>
                        <td>{w.department}</td>
                        <td>{w.worker_type === 'contract' ? 'Contract' : 'Company'}</td>
                        <td>{w.designation || '–'}</td>
                        <td>{w.doj ? new Date(w.doj + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}</td>
                        <td className="th-col-exp" style={{ whiteSpace: 'nowrap' }}>
                          {w.worker_type === 'contract' || w.department === 'Ext. Manpower' || !w.doj ? (
                            <span className="exp-dash">—</span>
                          ) : (
                            <span className="exp-pill">{formatExperience(w.doj, w.worker_type, w.department)}</span>
                          )}
                        </td>
                        <td className="num">{w.basic_salary || '–'}</td>
                        <td className="num">{w.allowance || '–'}</td>
                        <td className="num">{w.duty_rate_hr || '–'}</td>
                        <td className="num">{w.ot_rate || '–'}</td>
                        <td className="num">{w.rov_monthly || '–'}</td>
                        <td className="num">{w.transport_monthly || '–'}</td>
                        <td className="num">{w.other_expense_hr || '–'}</td>
                        <td className="num">{w.additional_allowance || '–'}</td>
                        <td><button className="rowlink" onClick={() => setEditingWorker(w)}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        <CompanyManager />
        </>
      )}

      {activeTab === 'holidays' && (
        <HolidayManager year={year} holidays={holidays} setHolidays={setHolidays} holErr={holErr} setHolErr={setHolErr} />
      )}

      {activeTab === 'supervisors' && (
        <SupervisorManager />
      )}

      {editingWorker && <EditWorkerModal worker={editingWorker} onClose={() => setEditingWorker(null)} onSaved={() => {
        setEditingWorker(null);
        Promise.all([
          api.overview(year, month, todayStr()),
          api.holidays(year).catch(() => ({ holidays: [] })),
        ]).then(([d, h]) => { setData(d); setHolidays(h.holidays || []); });
      }} />}

      {addingWorker && <AddWorkerModal onClose={() => setAddingWorker(false)} onSaved={() => {
        setAddingWorker(false);
        Promise.all([
          api.overview(year, month, todayStr()),
          api.holidays(year).catch(() => ({ holidays: [] })),
        ]).then(([d, h]) => { setData(d); setHolidays(h.holidays || []); });
      }} />}
    </div>
  );
}

function ShiftConfigManager() {
  const [config, setConfig] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ shift_start: '09:00', shift_end: '18:00', work_hours: '8', lunch_hours: '1' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.shiftConfig()
      .then((d) => {
        setConfig(d.config);
        setForm({
          shift_start: d.config.shift_start || '09:00',
          shift_end: d.config.shift_end || '18:00',
          work_hours: String(d.config.work_hours || 8),
          lunch_hours: String(d.config.lunch_hours || 1),
        });
      })
      .catch(() => {});
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await api.updateShiftConfig({
        shift_start: form.shift_start,
        shift_end: form.shift_end,
        work_hours: Number(form.work_hours) || 8,
        lunch_hours: Number(form.lunch_hours) || 1,
      });
      setConfig(res.config);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ad-card-wrapper">
      <div className="ad-card-border-glow" aria-hidden="true" />
      <div className="ad-card">
        <div className="ad-card-shine-line" aria-hidden="true" />
        <div className="ad-card-corner-blob" aria-hidden="true" />
        <div className="ad-card-head">
          <div>
            <h2 className="ad-card-title">Shift & Break Configuration</h2>
            <p className="ad-card-sub">Set default shift hours, working hours per day, and lunch break duration. These apply to all workers.</p>
          </div>
          <button className="ad-btn ad-btn-primary" onClick={() => setEditing((v) => !v)}>
            <span className="ad-btn-primary-inner">{editing ? 'Cancel' : 'Edit Shift'}</span>
          </button>
        </div>

        {err && <div className="error-msg">{err}</div>}

        {!editing && config && (
          <div className="sc-display">
            <div className="sc-item"><span className="sc-label">Shift Start</span><span className="sc-val">{config.shift_start}</span></div>
            <div className="sc-item"><span className="sc-label">Shift End</span><span className="sc-val">{config.shift_end}</span></div>
            <div className="sc-item"><span className="sc-label">Work Hours / Day</span><span className="sc-val">{config.work_hours}h</span></div>
            <div className="sc-item"><span className="sc-label">Lunch Break</span><span className="sc-val">{config.lunch_hours}h</span></div>
          </div>
        )}

        {editing && (
          <form className="sc-form" onSubmit={handleSave}>
            <div className="sc-form-grid">
              <div className="field">
                <label>Shift start</label>
                <input className="input" type="time" value={form.shift_start} onChange={(e) => setForm((f) => ({ ...f, shift_start: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Shift end</label>
                <input className="input" type="time" value={form.shift_end} onChange={(e) => setForm((f) => ({ ...f, shift_end: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Work hours/day</label>
                <input className="input" type="number" min="1" max="24" step="0.5" value={form.work_hours} onChange={(e) => setForm((f) => ({ ...f, work_hours: e.target.value }))} required />
              </div>
              <div className="field">
                <label>Lunch break (hrs)</label>
                <input className="input" type="number" min="0" max="4" step="0.25" value={form.lunch_hours} onChange={(e) => setForm((f) => ({ ...f, lunch_hours: e.target.value }))} required />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="ad-btn ad-btn-primary" type="submit" disabled={busy}>
                <span className="ad-btn-primary-inner">{busy ? 'Saving…' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function HolidayManager({ year, holidays, setHolidays, holErr, setHolErr }) {
  const [addDate, setAddDate] = useState('');
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState('government');
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');

  const govtHols = holidays.filter((h) => h.type === 'government');
  const compHols = holidays.filter((h) => h.type === 'company');
  const filtered = typeFilter === 'all' ? holidays
    : typeFilter === 'government' ? govtHols : compHols;

  async function handleAdd(e) {
    e.preventDefault();
    if (!addDate || !addName.trim()) return setHolErr('Date and name are required');
    setBusy(true);
    setHolErr('');
    try {
      const res = await api.addHoliday(addDate, addName.trim(), addType);
      setHolidays((h) => [...h, res.holiday].sort((a, b) => a.date.localeCompare(b.date)));
      setAddDate('');
      setAddName('');
    } catch (e) {
      setHolErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteHoliday(id);
      setHolidays((h) => h.filter((x) => x.id !== id));
    } catch (e) {
      setHolErr(e.message);
    }
  }

  async function loadGovtHolidays() {
    setBulkBusy(true);
    setHolErr('');
    const existing = new Set(holidays.map((h) => h.date));
    let added = 0;
    for (const [md, name] of UAE_GOVT_HOLIDAYS) {
      const d = `${year}-${md}`;
      if (existing.has(d)) continue;
      try {
        const res = await api.addHoliday(d, name, 'government');
        setHolidays((h) => [...h, res.holiday].sort((a, b) => a.date.localeCompare(b.date)));
        added++;
      } catch {}
    }
    setBulkBusy(false);
    if (added === 0) setHolErr('All UAE government holidays already added for ' + year);
  }

  const fmtDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="ad-card-wrapper">
      <div className="ad-card-border-glow" aria-hidden="true" />
      <div className="ad-card">
        <div className="ad-card-shine-line" aria-hidden="true" />
        <div className="ad-card-corner-blob" aria-hidden="true" />
        <div className="ad-card-head">
          <div>
            <h2 className="ad-card-title">Holiday & Off-Day Calendar — {year}</h2>
            <p className="ad-card-sub">Manage government holidays (festivals) and company-declared off days. These are shown on worker calendars.</p>
          </div>
          <button className="ad-btn ad-btn-primary" onClick={loadGovtHolidays} disabled={bulkBusy}>
            <span className="ad-btn-primary-inner">{bulkBusy ? 'Adding…' : 'Load UAE Govt Holidays'}</span>
          </button>
        </div>

        {holErr && <div className="error-msg">{holErr}</div>}

        <form className="hol-form" onSubmit={handleAdd}>
          <input className="input" type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} required />
          <input className="input" placeholder="Holiday name or reason…" value={addName} onChange={(e) => setAddName(e.target.value)} required style={{ flex: 1 }} />
          <select className="input" value={addType} onChange={(e) => setAddType(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
            <option value="government">Government Holiday</option>
            <option value="company">Company Off Day</option>
          </select>
          <button className="ad-btn ad-btn-primary" type="submit" disabled={busy}>
            <span className="ad-btn-primary-inner">{busy ? 'Adding…' : 'Add'}</span>
          </button>
        </form>

        <div className="ad-chips" style={{ marginTop: 16 }}>
          <button className={`ad-chip${typeFilter === 'all' ? ' active' : ''}`} onClick={() => setTypeFilter('all')}>
            All <span className="ad-chip-count">{holidays.length}</span>
          </button>
          <button className={`ad-chip${typeFilter === 'government' ? ' active' : ''}`} onClick={() => setTypeFilter('government')}>
            Government <span className="ad-chip-count">{govtHols.length}</span>
          </button>
          <button className={`ad-chip${typeFilter === 'company' ? ' active' : ''}`} onClick={() => setTypeFilter('company')}>
            Company <span className="ad-chip-count">{compHols.length}</span>
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="muted" style={{ padding: 20, textAlign: 'center' }}>
            No holidays added for {year} yet. Use the form above or load UAE government holidays.
          </div>
        ) : (
          <div className="hol-list">
            {filtered.map((h) => (
              <div key={h.id} className="hol-row">
                <div className="hol-info">
                  <span className={`hol-type-badge ${h.type}`}>{h.type === 'government' ? 'Govt' : 'Company'}</span>
                  <span className="hol-date">{fmtDate(h.date)}</span>
                  <span className="hol-name">{h.name}</span>
                </div>
                <button className="hol-del" onClick={() => handleDelete(h.id)} title="Remove">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SupervisorManager() {
  const [sups, setSups] = useState([]);
  const [supErr, setSupErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ username: '', password: '', name: '', email: '', phone: '' });
  const [addBusy, setAddBusy] = useState(false);
  const [toggling, setToggling] = useState(new Set());
  const [editingSup, setEditingSup] = useState(null);

  useEffect(() => {
    api.supervisors()
      .then((d) => { setSups(d.supervisors || []); setLoading(false); })
      .catch((e) => { setSupErr(e.message); setLoading(false); });
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setAddBusy(true);
    setSupErr('');
    try {
      const res = await api.addSupervisor(addForm);
      setSups((prev) => [res.supervisor, ...prev]);
      setAddForm({ username: '', password: '', name: '', email: '', phone: '' });
      setShowAdd(false);
    } catch (err) {
      setSupErr(err.message);
    } finally {
      setAddBusy(false);
    }
  }

  async function toggleActive(sup) {
    setToggling((s) => new Set(s).add(sup.id));
    setSupErr('');
    try {
      const res = await api.updateSupervisor(sup.id, { active: !sup.active });
      setSups((prev) => prev.map((s) => s.id === sup.id ? res.supervisor : s));
    } catch (err) {
      setSupErr(err.message);
    } finally {
      setToggling((s) => { const n = new Set(s); n.delete(sup.id); return n; });
    }
  }

  const active = sups.filter((s) => s.active);
  const inactive = sups.filter((s) => !s.active);

  return (
    <div className="ad-card-wrapper">
      <div className="ad-card-border-glow" aria-hidden="true" />
      <div className="ad-card">
        <div className="ad-card-shine-line" aria-hidden="true" />
        <div className="ad-card-corner-blob" aria-hidden="true" />
        <div className="ad-card-head">
          <div>
            <h2 className="ad-card-title">Supervisor Accounts</h2>
            <p className="ad-card-sub">Add, view or deactivate supervisor login accounts. Deactivated supervisors cannot sign in.</p>
          </div>
          <button className="ad-btn ad-btn-primary" onClick={() => setShowAdd((v) => !v)}>
            <span className="ad-btn-primary-inner">{showAdd ? 'Cancel' : '+ Add Supervisor'}</span>
          </button>
        </div>

        {supErr && <div className="error-msg">{supErr}</div>}

        {showAdd && (
          <form className="sup-add-form" onSubmit={handleAdd}>
            <div className="sup-form-grid">
              <div className="field">
                <label>Full name *</label>
                <input className="input" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Ahmed Hassan" required />
              </div>
              <div className="field">
                <label>Username *</label>
                <input className="input" value={addForm.username} onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))} placeholder="e.g. ahmed.h" required />
              </div>
              <div className="field">
                <label>Password *</label>
                <input className="input" type="password" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" required />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} placeholder="supervisor@company.com" />
              </div>
              <div className="field">
                <label>Phone</label>
                <input className="input" value={addForm.phone} onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+971 50 123 4567" />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="ad-btn ad-btn-primary" type="submit" disabled={addBusy}>
                <span className="ad-btn-primary-inner">{addBusy ? 'Adding…' : 'Create Supervisor'}</span>
              </button>
            </div>
          </form>
        )}

      {loading ? (
        <div className="admin-skeleton">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-row"><div className="skeleton-cell wide" /><div className="skeleton-cell" /><div className="skeleton-cell narrow" /></div>
          ))}
        </div>
      ) : sups.length === 0 ? (
        <div className="muted" style={{ padding: 24, textAlign: 'center' }}>No supervisor accounts yet. Add one above.</div>
      ) : (
        <div className="sup-list">
          {active.length > 0 && (
            <>
              <div className="sup-section-label">Active ({active.length})</div>
              {active.map((s) => (
                <div key={s.id} className="sup-row">
                  <div className="sup-row-info">
                    <div className="sup-row-name">{s.name}</div>
                    <div className="sup-row-meta">@{s.username}{s.email ? ` · ${s.email}` : ''}{s.phone ? ` · ${s.phone}` : ''}</div>
                    <div className="sup-row-date">Added {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div className="sup-row-actions">
                    <span className="sup-badge active">Active</span>
                    <button className="sup-edit-btn" onClick={() => setEditingSup(s)} title="Edit supervisor">✎</button>
                    <button className="sup-toggle-btn deactivate" onClick={() => toggleActive(s)} disabled={toggling.has(s.id)}>
                      {toggling.has(s.id) ? '…' : 'Deactivate'}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
          {inactive.length > 0 && (
            <>
              <div className="sup-section-label">Deactivated ({inactive.length})</div>
              {inactive.map((s) => (
                <div key={s.id} className="sup-row inactive">
                  <div className="sup-row-info">
                    <div className="sup-row-name">{s.name}</div>
                    <div className="sup-row-meta">@{s.username}{s.email ? ` · ${s.email}` : ''}</div>
                  </div>
                  <div className="sup-row-actions">
                    <span className="sup-badge inactive">Inactive</span>
                    <button className="sup-edit-btn" onClick={() => setEditingSup(s)} title="Edit supervisor">✎</button>
                    <button className="sup-toggle-btn activate" onClick={() => toggleActive(s)} disabled={toggling.has(s.id)}>
                      {toggling.has(s.id) ? '…' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {editingSup && <EditSupervisorModal sup={editingSup} onClose={() => setEditingSup(null)} onSaved={(updated) => {
        setSups((prev) => prev.map((s) => s.id === updated.id ? { ...s, ...updated } : s));
        setEditingSup(null);
      }} />}
      </div>
    </div>
  );
}

function EditWorkerModal({ worker, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: worker.name || '',
    department: worker.department || '',
    designation: worker.designation || '',
    workerType: worker.worker_type || 'company',
    basicSalary: worker.basic_salary || 0,
    allowance: worker.allowance || 0,
    otRate: worker.ot_rate || 0,
    dutyRateHr: worker.duty_rate_hr || 0,
    doj: worker.doj || '',
    rovMonthly: worker.rov_monthly || 0,
    transportMonthly: worker.transport_monthly || 0,
    otherExpenseHr: worker.other_expense_hr || 0,
    additionalAllowance: worker.additional_allowance || 0,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.updateWorker(worker.id, form);
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to update worker');
      setBusy(false);
    }
  }

  const isContract = form.workerType === 'contract';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <h3>Edit Worker — {worker.id}</h3>
        <div className="msub">Update details for {worker.name}.</div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <div className="field">
              <label>Name *</label>
              <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="field">
              <label>Department *</label>
              <input className="input" value={form.department} onChange={e => set('department', e.target.value)} required />
            </div>
            <div className="field">
              <label>Designation</label>
              <input className="input" value={form.designation} onChange={e => set('designation', e.target.value)} />
            </div>
            <div className="field">
              <label>Type</label>
              <select className="input" value={form.workerType} onChange={e => set('workerType', e.target.value)}>
                <option value="company">Company</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <div className="field">
              <label>Date of Joining</label>
              <input className="input" type="date" value={form.doj} onChange={e => set('doj', e.target.value)} />
            </div>
            {!isContract && (
              <>
                <div className="field">
                  <label>Basic Salary (AED)</label>
                  <input className="input" type="number" step="0.01" value={form.basicSalary} onChange={e => set('basicSalary', e.target.value)} />
                </div>
                <div className="field">
                  <label>Allowance (AED)</label>
                  <input className="input" type="number" step="0.01" value={form.allowance} onChange={e => set('allowance', e.target.value)} />
                </div>
              </>
            )}
            {isContract && (
              <div className="field">
                <label>Duty Rate / hr (AED)</label>
                <input className="input" type="number" step="0.01" value={form.dutyRateHr} onChange={e => set('dutyRateHr', e.target.value)} />
              </div>
            )}
            <div className="field">
              <label>OT Rate / hr (AED)</label>
              <input className="input" type="number" step="0.01" value={form.otRate} onChange={e => set('otRate', e.target.value)} />
            </div>
            <div className="field">
              <label>Room/Office/Visa / mo (AED)</label>
              <input className="input" type="number" step="0.01" value={form.rovMonthly} onChange={e => set('rovMonthly', e.target.value)} />
            </div>
            <div className="field">
              <label>Transport / mo (AED)</label>
              <input className="input" type="number" step="0.01" value={form.transportMonthly} onChange={e => set('transportMonthly', e.target.value)} />
            </div>
            <div className="field">
              <label>Other Expense / hr (AED)</label>
              <input className="input" type="number" step="0.01" value={form.otherExpenseHr} onChange={e => set('otherExpenseHr', e.target.value)} />
            </div>
            <div className="field">
              <label>Additional Allowance / mo (AED)</label>
              <input className="input" type="number" step="0.01" value={form.additionalAllowance} onChange={e => set('additionalAllowance', e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="ad-btn ad-btn-primary" disabled={busy}>
              <span className="ad-btn-primary-inner">{busy ? 'Saving…' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddWorkerModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', department: '', designation: '',
    workerType: 'company', basicSalary: '', allowance: '',
    otRate: '', dutyRateHr: '', doj: '',
    rovMonthly: '', transportMonthly: '', otherExpenseHr: '', additionalAllowance: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isContract = form.workerType === 'contract';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.addWorker({
        name: form.name, department: form.department, designation: form.designation,
        workerType: form.workerType,
        basicSalary: Number(form.basicSalary) || 0,
        allowance: Number(form.allowance) || 0,
        otRate: Number(form.otRate) || 0,
        dutyRateHr: Number(form.dutyRateHr) || 0,
        doj: form.doj || null,
        rovMonthly: Number(form.rovMonthly) || 0,
        transportMonthly: Number(form.transportMonthly) || 0,
        otherExpenseHr: Number(form.otherExpenseHr) || 0,
        additionalAllowance: Number(form.additionalAllowance) || 0,
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to add worker');
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <h3>Add New Worker</h3>
        <div className="msub">Fill in the details for the new employee.</div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <div className="field">
              <label>Name *</label>
              <input className="input" autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ahmed Hassan" required />
            </div>
            <div className="field">
              <label>Type *</label>
              <select className="input" value={form.workerType} onChange={e => set('workerType', e.target.value)}>
                <option value="company">Company</option>
                <option value="contract">Contract (Ext.)</option>
              </select>
            </div>
            <div className="field">
              <label>Department *</label>
              <input className="input" value={form.department} onChange={e => set('department', e.target.value)} placeholder={isContract ? 'Ext. Manpower' : 'e.g. Electrical'} required />
            </div>
            <div className="field">
              <label>Designation</label>
              <input className="input" value={form.designation} onChange={e => set('designation', e.target.value)} placeholder="e.g. Electrician" />
            </div>
            <div className="field">
              <label>Date of Joining</label>
              <input className="input" type="date" value={form.doj} onChange={e => set('doj', e.target.value)} />
            </div>
            {!isContract && (
              <>
                <div className="field">
                  <label>Basic Salary (AED)</label>
                  <input className="input" type="number" step="0.01" value={form.basicSalary} onChange={e => set('basicSalary', e.target.value)} placeholder="e.g. 1500" />
                </div>
                <div className="field">
                  <label>Allowance (AED)</label>
                  <input className="input" type="number" step="0.01" value={form.allowance} onChange={e => set('allowance', e.target.value)} placeholder="e.g. 500" />
                </div>
              </>
            )}
            {isContract && (
              <div className="field">
                <label>Duty Rate / hr (AED)</label>
                <input className="input" type="number" step="0.01" value={form.dutyRateHr} onChange={e => set('dutyRateHr', e.target.value)} placeholder="e.g. 8.50" />
              </div>
            )}
            <div className="field">
              <label>OT Rate / hr (AED)</label>
              <input className="input" type="number" step="0.01" value={form.otRate} onChange={e => set('otRate', e.target.value)} placeholder={isContract ? 'Same as duty if blank' : 'Auto from basic if 0'} />
            </div>
            <div className="field">
              <label>Room/Office/Visa / mo (AED)</label>
              <input className="input" type="number" step="0.01" value={form.rovMonthly} onChange={e => set('rovMonthly', e.target.value)} placeholder={isContract ? '550' : '1050'} />
            </div>
            <div className="field">
              <label>Transport / mo (AED)</label>
              <input className="input" type="number" step="0.01" value={form.transportMonthly} onChange={e => set('transportMonthly', e.target.value)} placeholder="300" />
            </div>
            <div className="field">
              <label>Other Expense / hr (AED)</label>
              <input className="input" type="number" step="0.01" value={form.otherExpenseHr} onChange={e => set('otherExpenseHr', e.target.value)} placeholder={isContract ? '3.66' : '5.82'} />
            </div>
            <div className="field">
              <label>Additional Allowance / mo (AED)</label>
              <input className="input" type="number" step="0.01" value={form.additionalAllowance} onChange={e => set('additionalAllowance', e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="ad-btn ad-btn-primary" disabled={busy}>
              <span className="ad-btn-primary-inner">{busy ? 'Adding…' : 'Add Worker'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditSupervisorModal({ sup, onClose, onSaved }) {
  const [name, setName] = useState(sup.name);
  const [email, setEmail] = useState(sup.email || '');
  const [phone, setPhone] = useState(sup.phone || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { name, email, phone };
      if (password.trim()) payload.password = password;
      const d = await api.updateSupervisor(sup.id, payload);
      onSaved(d.supervisor);
    } catch (err) {
      setError(err.message || 'Could not update supervisor');
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit supervisor — @{sup.username}</h3>
        <div className="msub">Update details for this supervisor. Leave password blank to keep unchanged.</div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Full name *</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>New password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="ad-btn ad-btn-primary" disabled={busy}>
              <span className="ad-btn-primary-inner">{busy ? 'Saving…' : 'Save changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function sumCol(data, key) {
  return data?.rows?.reduce((s, r) => s + r[key], 0) ?? '…';
}

function monthName(m) {
  if (!m) return '';
  return new Date(2026, Number(m) - 1, 1).toLocaleString('en', { month: 'long' });
}

function years() {
  const y = new Date().getFullYear();
  return [y + 1, y, y - 1, y - 2];
}

function CompanyManager() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [err, setErr] = useState('');
  const [editingCompany, setEditingCompany] = useState(null);
  const [toggling, setToggling] = useState(new Set());

  useEffect(() => {
    loadCompanies();
  }, []);

  function loadCompanies() {
    setLoading(true);
    api.companies(true)
      .then((d) => { setCompanies(d.companies || []); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddBusy(true);
    setErr('');
    try {
      const res = await api.addCompany({ name: newName.trim() });
      setCompanies((prev) => [...prev, res.company]);
      setNewName('');
      setShowAdd(false);
    } catch (error) {
      setErr(error.message);
    } finally {
      setAddBusy(false);
    }
  }

  async function toggleActive(comp) {
    setToggling((s) => new Set(s).add(comp.id));
    setErr('');
    try {
      const res = await api.updateCompany(comp.id, { active: !comp.active });
      setCompanies((prev) => prev.map((c) => c.id === comp.id ? res.company : c));
    } catch (error) {
      setErr(error.message);
    } finally {
      setToggling((s) => { const n = new Set(s); n.delete(comp.id); return n; });
    }
  }

  async function handleDelete(comp) {
    if (!window.confirm(`Are you sure you want to delete company "${comp.name}"?`)) return;
    setErr('');
    try {
      await api.deleteCompany(comp.id);
      setCompanies((prev) => prev.filter((c) => c.id !== comp.id));
    } catch (error) {
      setErr(error.message);
    }
  }

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <div className="ad-card-wrapper" style={{ marginTop: 28 }}>
      <div className="ad-card-border-glow" aria-hidden="true" />
      <div className="ad-card">
        <div className="ad-card-shine-line" aria-hidden="true" />
        <div className="ad-card-corner-blob" aria-hidden="true" />
        <div className="ad-card-head" style={{ flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2 className="ad-card-title">Manage Companies / Sites</h2>
            <p className="ad-card-sub">Client companies and job sites for daily worker deployment, site tracking, and billing.</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="ad-btn ad-btn-primary" onClick={() => setShowAdd((v) => !v)}>
              <span className="ad-btn-primary-inner">{showAdd ? 'Cancel' : '+ Add Company'}</span>
            </button>
          </div>
        </div>

        {err && <div className="error-msg">{err}</div>}

        {showAdd && (
          <form className="company-add-form" onSubmit={handleAdd} style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, color: '#e2e8f0' }}>Add New Company / Client Site</h4>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 300px' }}>
                <input
                  className="input"
                  placeholder="e.g. Jelnar Electrical/Creek, Experts Group/Sensoria..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button type="submit" className="ad-btn ad-btn-primary" disabled={addBusy}>
                <span className="ad-btn-primary-inner">{addBusy ? 'Saving…' : 'Save Company'}</span>
              </button>
              <button type="button" className="btn ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        )}

        <div className="company-search-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div className="company-count-badge" style={{ fontSize: 13, color: '#94a3b8' }}>
            Total Companies: <strong>{companies.length}</strong> (Active: {companies.filter(c => c.active).length})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Search:</span>
            <input
              className="input"
              style={{ width: 220, padding: '6px 12px', fontSize: 13 }}
              placeholder="Filter by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="admin-skeleton">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton-cell wide" />
                <div className="skeleton-cell" />
                <div className="skeleton-cell narrow" />
              </div>
            ))}
          </div>
        ) : (
          <div className="ad-table-container">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="num th-col-id" style={{ width: 44, textAlign: 'center' }}>#</th>
                  <th className="th-col-name">Company / Site Name</th>
                  <th style={{ width: 120, textAlign: 'center' }}>Status</th>
                  <th style={{ width: 180, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => (
                  <tr key={c.id || idx}>
                    <td className="num">{idx + 1}</td>
                    <td>
                      <strong style={{ fontSize: '0.96em' }}>{c.name}</strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`site-status-pill ${c.active ? 'active' : 'inactive'}`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="rowlink" onClick={() => setEditingCompany(c)} style={{ marginRight: 10 }}>Edit</button>
                      <button
                        className="rowlink"
                        style={{ color: c.active ? '#f59e0b' : '#10b981', marginRight: 10 }}
                        onClick={() => toggleActive(c)}
                        disabled={toggling.has(c.id)}
                      >
                        {c.active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="rowlink"
                        style={{ color: '#ef4444' }}
                        onClick={() => handleDelete(c)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 24 }}>
                      {search ? `No companies match "${search}".` : 'No companies registered.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingCompany && (
        <EditCompanyModal
          company={editingCompany}
          onClose={() => setEditingCompany(null)}
          onSaved={(updated) => {
            setCompanies((prev) => prev.map((c) => c.id === updated.id ? updated : c));
            setEditingCompany(null);
          }}
        />
      )}
    </div>
  );
}

function EditCompanyModal({ company, onClose, onSaved }) {
  const [name, setName] = useState(company.name || '');
  const [active, setActive] = useState(company.active !== false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.updateCompany(company.id, { name: name.trim(), active });
      onSaved(res.company);
    } catch (err) {
      setError(err.message || 'Failed to update company');
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <h3>Edit Company / Site</h3>
        <div className="msub">Update company name or active status.</div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Company / Site Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span>Active (available in supervisor site dropdown)</span>
            </label>
          </div>
          <div className="modal-actions" style={{ marginTop: 22 }}>
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="ad-btn ad-btn-primary" disabled={busy}>
              <span className="ad-btn-primary-inner">{busy ? 'Saving…' : 'Save changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
