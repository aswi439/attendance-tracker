import React, { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useTheme } from '../App.jsx';
import Ring from '../Ring.jsx';
import { GlassFold } from '@/components/ui/glass-fold';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const LEAVE_META = {
  ml: ['Medical Leave', '#E45863'],
  emergency: ['Emergency', '#D97706'],
  work_related: ['Work-related', '#8B7CF6'],
  casual: ['Casual', '#E8C56B'],
  unpaid: ['Unpaid', '#8E9BB3'],
  unspecified: ['Unspecified', '#64C7A9'],
};
const LEAVE_KEYS = Object.keys(LEAVE_META);
const LEAVE_COLORS = Object.fromEntries(LEAVE_KEYS.map((k) => [k, LEAVE_META[k][1]]));
const LEAVE_LABELS = Object.fromEntries(LEAVE_KEYS.map((k) => [k, LEAVE_META[k][0]]));
const LEAVE_SHORT = { ml: 'ML', emergency: 'Emergency', work_related: 'Work', casual: 'Casual', unpaid: 'Unpaid', unspecified: 'Unspec.' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function generateFilteredPDF(data, year, id, periodInfo) {
  const { label, slug, summaryRows, dailyRows, totals } = periodInfo;
  const doc = new jsPDF();
  const worker = data?.worker || {};

  // Header Banner
  doc.setFillColor(10, 18, 35);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Worker Attendance & Wages Report', 14, 15);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(56, 189, 248);
  doc.text(`${worker.name || id} (${worker.id || id}) · ${worker.department || 'No department'} · ${label}`, 14, 23);

  // Table 1: Periodic Summary Breakdown
  const sumHeaders = ['Period', 'Present', 'Late', 'Absent', 'Avg %', 'Duty Hrs', 'OT Hrs', 'Duty Pay', 'OT Pay', 'Total Wages', 'ML', 'Emg', 'Work', 'Cas', 'Unp'];
  const sumData = (summaryRows || []).map((r) => [
    r.label,
    r.presentDays ?? 0,
    r.lateDays ?? 0,
    r.absentDays ?? 0,
    r.pct != null ? `${r.pct}%` : '–',
    r.totalDutyHours ?? 0,
    r.totalOvertimeHours ?? 0,
    r.totalDailyWage ? `AED ${Number(r.totalDailyWage).toFixed(2)}` : '–',
    r.totalOvertimeWage ? `AED ${Number(r.totalOvertimeWage).toFixed(2)}` : '–',
    r.totalWage ? `AED ${Number(r.totalWage).toFixed(2)}` : (r.totalDailyWage || r.totalOvertimeWage ? `AED ${(Number(r.totalDailyWage || 0) + Number(r.totalOvertimeWage || 0)).toFixed(2)}` : '–'),
    r.ml ?? 0,
    r.emergency ?? 0,
    r.workRelated ?? 0,
    r.casual ?? 0,
    r.unpaid ?? 0,
  ]);

  if (totals) {
    sumData.push([
      'Total',
      totals.p ?? 0,
      totals.late ?? 0,
      totals.a ?? 0,
      totals.pct != null ? `${totals.pct}%` : '–',
      totals.dutyHrs ?? 0,
      totals.otHrs ?? 0,
      totals.dutyWage ? `AED ${Number(totals.dutyWage).toFixed(2)}` : '–',
      totals.otWage ? `AED ${Number(totals.otWage).toFixed(2)}` : '–',
      totals.totalWage ? `AED ${Number(totals.totalWage).toFixed(2)}` : '–',
      totals.ml ?? 0,
      totals.emg ?? 0,
      totals.wr ?? 0,
      totals.ca ?? 0,
      totals.un ?? 0,
    ]);
  }

  autoTable(doc, {
    startY: 36,
    head: [sumHeaders],
    body: sumData,
    theme: 'grid',
    headStyles: { fillColor: [10, 25, 55], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
    styles: { fontSize: 7, cellPadding: 2.2, halign: 'center' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: [243, 247, 252] },
  });

  const finalY = (doc.lastAutoTable?.finalY || 40) + 10;
  doc.setFontSize(12);
  doc.setTextColor(10, 25, 55);
  doc.setFont('helvetica', 'bold');
  doc.text(`Daily Records — ${label} (${dailyRows.length} days recorded)`, 14, finalY);

  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dailyData = (dailyRows || []).map((r) => [
    r.date,
    dow[new Date(r.date + 'T00:00:00Z').getUTCDay()],
    r.status === 'present' ? (r.is_late ? 'Late' : 'Present') : 'Absent',
    r.duty_hours ? `${r.duty_hours}h` : '–',
    r.overtime_hours ? `${r.overtime_hours}h` : '–',
    r.daily_wage ? `AED ${Number(r.daily_wage).toFixed(2)}` : '–',
    r.overtime_wage ? `AED ${Number(r.overtime_wage).toFixed(2)}` : '–',
    r.leave_type ? (LEAVE_LABELS[r.leave_type] || r.leave_type) : '–',
    r.notes || '',
  ]);

  autoTable(doc, {
    startY: finalY + 4,
    head: [['Date', 'Day', 'Status', 'Duty', 'OT', 'Duty Pay', 'OT Pay', 'Leave Type', 'Notes']],
    body: dailyData.length > 0 ? dailyData : [['–', '–', 'No daily records in this period', '–', '–', '–', '–', '–', '–']],
    theme: 'grid',
    headStyles: { fillColor: [10, 25, 55], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    styles: { fontSize: 7, cellPadding: 2.2 },
    alternateRowStyles: { fillColor: [243, 247, 252] },
  });

  doc.save(`attendance-${id}-${slug}.pdf`);
}

function generateFilteredXLSX(data, year, id, periodInfo) {
  const { label, slug, summaryRows, dailyRows, totals } = periodInfo;
  const wb = XLSX.utils.book_new();

  const sumRows = (summaryRows || []).map((r) => ({
    Period: r.label,
    'Present Days': r.presentDays ?? 0,
    'Late Days': r.lateDays ?? 0,
    'Absent Days': r.absentDays ?? 0,
    'Attendance %': r.pct != null ? `${r.pct}%` : '–',
    'Duty Hours': r.totalDutyHours ?? 0,
    'OT Hours': r.totalOvertimeHours ?? 0,
    'Duty Pay (AED)': r.totalDailyWage ?? 0,
    'OT Pay (AED)': r.totalOvertimeWage ?? 0,
    'Total Wages (AED)': r.totalWage ?? (Number(r.totalDailyWage || 0) + Number(r.totalOvertimeWage || 0)),
    'Medical Leave': r.ml ?? 0,
    Emergency: r.emergency ?? 0,
    'Work-related': r.workRelated ?? 0,
    Casual: r.casual ?? 0,
    Unpaid: r.unpaid ?? 0,
    Unspecified: r.unspecified ?? 0,
  }));

  if (totals) {
    sumRows.push({
      Period: 'TOTAL',
      'Present Days': totals.p ?? 0,
      'Late Days': totals.late ?? 0,
      'Absent Days': totals.a ?? 0,
      'Attendance %': totals.pct != null ? `${totals.pct}%` : '–',
      'Duty Hours': totals.dutyHrs ?? 0,
      'OT Hours': totals.otHrs ?? 0,
      'Duty Pay (AED)': totals.dutyWage ?? 0,
      'OT Pay (AED)': totals.otWage ?? 0,
      'Total Wages (AED)': totals.totalWage ?? 0,
      'Medical Leave': totals.ml ?? 0,
      Emergency: totals.emg ?? 0,
      'Work-related': totals.wr ?? 0,
      Casual: totals.ca ?? 0,
      Unpaid: totals.un ?? 0,
      Unspecified: totals.us ?? 0,
    });
  }

  const ws1 = XLSX.utils.json_to_sheet(sumRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Periodic Summary');

  const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dailyData = (dailyRows || []).map((r) => ({
    Date: r.date,
    Day: dow[new Date(r.date + 'T00:00:00Z').getUTCDay()],
    Status: r.status === 'present' ? (r.is_late ? 'Late Present' : 'Present') : 'Absent',
    'Duty Hours': r.duty_hours || 0,
    'OT Hours': r.overtime_hours || 0,
    'Duty Pay (AED)': r.daily_wage || 0,
    'OT Pay (AED)': r.overtime_wage || 0,
    'Leave Type': r.leave_type ? (LEAVE_LABELS[r.leave_type] || r.leave_type) : '',
    Notes: r.notes || '',
    'Marked By': r.recorded_by || '',
  }));

  const ws2 = XLSX.utils.json_to_sheet(dailyData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Daily Records');

  XLSX.writeFile(wb, `attendance-${id}-${slug}.xlsx`);
}

function generateFilteredCSV(data, year, id, periodInfo) {
  const { label, slug, summaryRows, dailyRows, totals } = periodInfo;
  const worker = data?.worker || {};

  const lines = [
    `"Worker Attendance & Wages Report - ${worker.name || id} (${worker.id || id}) - ${label}"`,
    `"Department: ${worker.department || 'No department'} | Year: ${year} | Generated: ${new Date().toISOString().slice(0, 10)}"`,
    '',
    '--- PERIOD SUMMARY BREAKDOWN ---',
    'Period,Present Days,Late Days,Absent Days,Attendance %,Duty Hours,OT Hours,Duty Pay (AED),OT Pay (AED),Total Wages (AED),Medical Leave,Emergency,Work-related,Casual,Unpaid,Unspecified',
    ...(summaryRows || []).map((r) =>
      [
        r.label,
        r.presentDays ?? 0,
        r.lateDays ?? 0,
        r.absentDays ?? 0,
        r.pct != null ? `${r.pct}%` : '–',
        r.totalDutyHours ?? 0,
        r.totalOvertimeHours ?? 0,
        r.totalDailyWage ?? 0,
        r.totalOvertimeWage ?? 0,
        r.totalWage ?? (Number(r.totalDailyWage || 0) + Number(r.totalOvertimeWage || 0)),
        r.ml ?? 0,
        r.emergency ?? 0,
        r.workRelated ?? 0,
        r.casual ?? 0,
        r.unpaid ?? 0,
        r.unspecified ?? 0,
      ].map(csvEscape).join(',')
    ),
  ];

  if (totals) {
    lines.push([
      'TOTAL',
      totals.p ?? 0,
      totals.late ?? 0,
      totals.a ?? 0,
      totals.pct != null ? `${totals.pct}%` : '–',
      totals.dutyHrs ?? 0,
      totals.otHrs ?? 0,
      totals.dutyWage ?? 0,
      totals.otWage ?? 0,
      totals.totalWage ?? 0,
      totals.ml ?? 0,
      totals.emg ?? 0,
      totals.wr ?? 0,
      totals.ca ?? 0,
      totals.un ?? 0,
      totals.us ?? 0,
    ].map(csvEscape).join(','));
  }

  lines.push('');
  lines.push(`--- DAILY ATTENDANCE RECORDS (${label}) ---`);
  lines.push('Date,Day,Status,Duty Hours,OT Hours,Duty Pay (AED),OT Pay (AED),Leave Type,Notes,Marked By');

  const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const r of dailyRows || []) {
    lines.push([
      r.date,
      dow[new Date(r.date + 'T00:00:00Z').getUTCDay()],
      r.status === 'present' ? (r.is_late ? 'Late Present' : 'Present') : 'Absent',
      r.duty_hours || 0,
      r.overtime_hours || 0,
      r.daily_wage || 0,
      r.overtime_wage || 0,
      r.leave_type ? (LEAVE_LABELS[r.leave_type] || r.leave_type) : '',
      r.notes || '',
      r.recorded_by || '',
    ].map(csvEscape).join(','));
  }

  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `attendance-${id}-${slug}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
function numToWords(n) {
  if (n === 0) return 'Zero';
  const parts = [];
  const intPart = Math.floor(n);
  if (intPart >= 1000) { parts.push(ONES[Math.floor(intPart / 1000)] + ' Thousand'); }
  const rem = intPart % 1000;
  if (rem >= 100) { parts.push(ONES[Math.floor(rem / 100)] + ' Hundred'); }
  const r2 = rem % 100;
  if (r2 >= 20) { parts.push(TENS[Math.floor(r2 / 10)] + (r2 % 10 ? '-' + ONES[r2 % 10] : '')); }
  else if (r2 > 0) { parts.push(ONES[r2]); }
  return parts.join(' ') || 'Zero';
}

async function generatePaySlip(id, year, month) {
  const data = await api.payslip(id, year, month);
  const doc = new jsPDF();
  const w = data.worker;
  const s = data.salary;
  const monthName = MONTHS[Number(month) - 1];
  const pageW = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(12, 22, 42);
  doc.rect(0, 0, pageW, 42, 'F');
  doc.setFillColor(0, 147, 184);
  doc.rect(0, 42, pageW, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AL TABA TECHNICAL SERVICES L.L.C', 14, 16);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 220);
  doc.text('P.O. Box: 410634 · Deira Murar Building No. 14, Flat 204, Frij Al Murra · Deira Dubai, UAE', 14, 24);
  doc.text('Tel: +971 4 3470252 · Cell: +971 0563442009 · Email: altabadubai@gmail.com', 14, 30);

  // Title bar
  doc.setFillColor(240, 244, 248);
  doc.rect(14, 50, pageW - 28, 12, 'F');
  doc.setTextColor(12, 22, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SALARY PAY SLIP', pageW / 2, 58, { align: 'center' });

  // Employee info grid
  let y = 70;
  doc.setFontSize(9);
  const drawField = (label, val, x, yPos, w2) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(label, x, yPos);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(12, 22, 42);
    doc.text(String(val || '—'), x + w2, yPos);
  };

  drawField('Name:', w.name, 14, y, 30);
  drawField('Month:', `${monthName} ${year}`, 120, y, 25);
  y += 8;
  drawField('Designation:', w.designation || w.department || '—', 14, y, 30);
  drawField('DOJ:', w.doj || '—', 120, y, 25);
  y += 8;
  drawField('Worker ID:', w.id, 14, y, 30);
  drawField('Absent:', String(s.absentDays), 120, y, 25);
  y += 8;
  drawField('Type:', w.worker_type === 'contract' ? 'Contract' : 'Company', 14, y, 30);
  drawField('Working Days:', String(s.presentDays), 120, y, 25);

  // Divider
  y += 10;
  doc.setDrawColor(200, 210, 220);
  doc.line(14, y, pageW - 14, y);

  // Salary breakdown table
  y += 8;
  doc.setFillColor(12, 22, 42);
  doc.rect(14, y, pageW - 28, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIPTION', 18, y + 6.5);
  doc.text('AMOUNT (AED)', pageW - 18, y + 6.5, { align: 'right' });
  y += 9;

  const rows = [];
  if (w.worker_type !== 'contract' && s.basic > 0) {
    rows.push(['Basic Salary', s.basic.toFixed(2)]);
    rows.push(['Allowance', s.allowance.toFixed(2)]);
  }
  rows.push(['Duty Wages (' + s.totalDutyHours + ' hrs)', s.dutyWage.toFixed(2)]);
  if (s.totalOvertimeHours > 0) rows.push(['Overtime Wages (' + s.totalOvertimeHours + ' hrs)', s.overtimeWage.toFixed(2)]);

  doc.setTextColor(12, 22, 42);
  for (let i = 0; i < rows.length; i++) {
    if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(14, y, pageW - 28, 9, 'F'); }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(rows[i][0], 18, y + 6.5);
    doc.text(rows[i][1], pageW - 18, y + 6.5, { align: 'right' });
    y += 9;
  }

  // Total row
  doc.setFillColor(0, 147, 184);
  doc.rect(14, y, pageW - 28, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL SALARY', 18, y + 7);
  doc.text('AED ' + s.totalSalary.toFixed(2), pageW - 18, y + 7, { align: 'right' });
  y += 16;

  // Amount in words
  doc.setTextColor(12, 22, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount in Words:', 14, y);
  doc.setFont('helvetica', 'italic');
  doc.text(numToWords(Math.round(s.totalSalary)) + ' Dirhams Only', 50, y);
  y += 14;

  // Signature section
  doc.setDrawColor(180, 190, 200);
  doc.line(14, y + 10, 80, y + 10);
  doc.line(pageW - 80, y + 10, pageW - 14, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Manager Signature', 14, y + 16);
  doc.text('Employee Signature', pageW - 80, y + 16);

  // Footer line
  doc.setFillColor(0, 147, 184);
  doc.rect(0, doc.internal.pageSize.getHeight() - 4, pageW, 4, 'F');

  doc.save(`payslip-${w.id}-${monthName}-${year}.pdf`);
}

function getThreeMonths(current) {
  let end = current;
  let start = end - 2;
  if (start < 1) start = 1;
  end = start + 2;
  if (end > 12) { end = 12; start = 10; }
  return [start, start + 1, end];
}

const PERIOD_VIEWS = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'halfyearly', label: 'Half-yearly' },
  { key: 'annual', label: 'Annual' },
];

const QUARTER_LABELS = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];
const HALF_LABELS = ['H1 (Jan–Jun)', 'H2 (Jul–Dec)'];

function aggregateMonths(monthly, groups) {
  return groups.map(({ label, months: mlist }) => {
    const agg = { label, presentDays: 0, lateDays: 0, absentDays: 0, ml: 0, emergency: 0, workRelated: 0, casual: 0, unpaid: 0, unspecified: 0, totalDutyHours: 0, totalOvertimeHours: 0, totalDailyWage: 0, totalOvertimeWage: 0, totalWage: 0, hasData: false };
    for (const m of mlist) {
      const mm = monthly.find((r) => r.month === String(m).padStart(2, '0'));
      if (!mm) continue;
      agg.hasData = true;
      agg.presentDays += mm.presentDays;
      agg.lateDays += mm.lateDays || 0;
      agg.absentDays += mm.absentDays;
      agg.ml += mm.ml;
      agg.emergency += mm.emergency;
      agg.workRelated += mm.workRelated;
      agg.casual += mm.casual;
      agg.unpaid += mm.unpaid;
      agg.unspecified += mm.unspecified;
      agg.totalDutyHours += mm.totalDutyHours || 0;
      agg.totalOvertimeHours += mm.totalOvertimeHours || 0;
      agg.totalDailyWage += mm.totalDailyWage || 0;
      agg.totalOvertimeWage += mm.totalOvertimeWage || 0;
      agg.totalWage += mm.totalWage || 0;
    }
    agg.totalDutyHours = Math.round(agg.totalDutyHours * 100) / 100;
    agg.totalOvertimeHours = Math.round(agg.totalOvertimeHours * 100) / 100;
    agg.totalDailyWage = Math.round(agg.totalDailyWage * 100) / 100;
    agg.totalOvertimeWage = Math.round(agg.totalOvertimeWage * 100) / 100;
    agg.totalWage = Math.round(agg.totalWage * 100) / 100;
    return agg;
  });
}

function fmtAED(v) { return v ? `AED ${v.toLocaleString()}` : '–'; }

export default function WorkerDetail({ me, onSignOut }) {
  const { id } = useParams();
  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [data, setData] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calView, setCalView] = useState(3);
  const [periodView, setPeriodView] = useState('monthly');
  const [summaryMonth, setSummaryMonth] = useState('all');
  const [summaryQuarter, setSummaryQuarter] = useState('all');
  const [summaryHalf, setSummaryHalf] = useState('all');
  const [err, setErr] = useState('');
  const [showDlMenu, setShowDlMenu] = useState(false);
  const [showPayslip, setShowPayslip] = useState(false);
  const [payslipMonth, setPayslipMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [genPS, setGenPS] = useState(false);
  const dlRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    Promise.all([api.worker(id, year), api.holidays(year)])
      .then(([d, h]) => {
        if (!alive) return;
        setData(d);
        setHolidays(h.holidays || []);
      })
      .catch((e) => setErr(e.message));
    return () => { alive = false; };
  }, [id, year]);

  const { dark, toggleTheme } = useTheme();

  useEffect(() => {
    const handler = (e) => {
      if (dlRef.current && !dlRef.current.contains(e.target)) setShowDlMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setShowDlMenu(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const monthly = data?.monthly || [];
  const stat = (m) => monthly.find((r) => r.month === String(m).padStart(2, '0')) || null;
  const recordsMap = {};
  for (const r of data?.records || []) recordsMap[r.date] = r;
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const holidayMap = {};
  for (const h of holidays) holidayMap[h.date] = { name: h.name, type: h.type || 'government' };

  const avgArrival = (() => {
    const presentRecords = (data?.records || []).filter((r) => r.status === 'present' && r.recorded_at);
    if (presentRecords.length === 0) return null;
    let totalMin = 0;
    for (const r of presentRecords) {
      const d = new Date(r.recorded_at);
      totalMin += d.getHours() * 60 + d.getMinutes();
    }
    const avg = Math.round(totalMin / presentRecords.length);
    const h = Math.floor(avg / 60);
    const m = avg % 60;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  })();

  const tot = monthly.reduce(
    (a, r) => ({
      p: a.p + r.presentDays, late: a.late + (r.lateDays || 0), a: a.a + r.absentDays, ml: a.ml + r.ml,
      emg: a.emg + r.emergency, wr: a.wr + r.workRelated, ca: a.ca + r.casual,
      un: a.un + r.unpaid, us: a.us + r.unspecified,
    }),
    { p: 0, late: 0, a: 0, ml: 0, emg: 0, wr: 0, ca: 0, un: 0, us: 0 },
  );
  const yearPct = tot.p + tot.a > 0 ? Math.round((tot.p / (tot.p + tot.a)) * 1000) / 10 : null;

  const monthPct = (s) => (s && s.presentDays + s.absentDays > 0
    ? Math.round((s.presentDays / (s.presentDays + s.absentDays)) * 1000) / 10
    : null);
  const monthsWithData = MONTHS.map((mn, i) => ({ mn, i, s: stat(i + 1) })).filter((x) => x.s);

  const periodRows = (() => {
    if (periodView === 'monthly') return null;
    if (periodView === 'quarterly') {
      const allQ = aggregateMonths(monthly, [
        { label: QUARTER_LABELS[0], months: [1,2,3] },
        { label: QUARTER_LABELS[1], months: [4,5,6] },
        { label: QUARTER_LABELS[2], months: [7,8,9] },
        { label: QUARTER_LABELS[3], months: [10,11,12] },
      ]);
      if (summaryQuarter !== 'all') return [allQ[Number(summaryQuarter)]];
      return allQ;
    }
    if (periodView === 'halfyearly') {
      const allH = aggregateMonths(monthly, [
        { label: HALF_LABELS[0], months: [1,2,3,4,5,6] },
        { label: HALF_LABELS[1], months: [7,8,9,10,11,12] },
      ]);
      if (summaryHalf !== 'all') return [allH[Number(summaryHalf)]];
      return allH;
    }
    return aggregateMonths(monthly, [
      { label: `Annual ${year}`, months: [1,2,3,4,5,6,7,8,9,10,11,12] },
    ]);
  })();

  const activePeriodInfo = (() => {
    const records = data?.records || [];
    let label = '';
    let badge = '';
    let slug = '';
    let summaryRows = [];
    let dailyRows = [];

    if (periodView === 'monthly') {
      if (summaryMonth === 'all') {
        label = `All Months ${year}`;
        badge = `All Months`;
        slug = `${year}-monthly-all`;
        summaryRows = monthsWithData.map(({ mn, s }) => ({
          label: mn,
          ...s,
          pct: monthPct(s),
        }));
        dailyRows = records;
      } else {
        const mNum = Number(summaryMonth);
        const mName = MONTHS[mNum - 1] || summaryMonth;
        label = `${mName} ${year}`;
        badge = `${mName} ${year}`;
        slug = `${year}-${summaryMonth}-${mName.toLowerCase()}`;
        const s = stat(mNum);
        summaryRows = s ? [{
          label: mName,
          ...s,
          pct: monthPct(s),
        }] : [{
          label: mName,
          presentDays: 0,
          lateDays: 0,
          absentDays: 0,
          pct: null,
          totalDutyHours: 0,
          totalOvertimeHours: 0,
          totalDailyWage: 0,
          totalOvertimeWage: 0,
          totalWage: 0,
          ml: 0,
          emergency: 0,
          workRelated: 0,
          casual: 0,
          unpaid: 0,
          unspecified: 0,
        }];
        dailyRows = records.filter((r) => Number(r.date.split('-')[1]) === mNum);
      }
    } else if (periodView === 'quarterly') {
      const qGroups = [
        { label: QUARTER_LABELS[0], code: 'Q1', months: [1, 2, 3] },
        { label: QUARTER_LABELS[1], code: 'Q2', months: [4, 5, 6] },
        { label: QUARTER_LABELS[2], code: 'Q3', months: [7, 8, 9] },
        { label: QUARTER_LABELS[3], code: 'Q4', months: [10, 11, 12] },
      ];
      if (summaryQuarter === 'all') {
        label = `All Quarters ${year}`;
        badge = `All Quarters`;
        slug = `${year}-quarterly-all`;
        summaryRows = (periodRows || []).map((r) => ({
          ...r,
          pct: r.presentDays + r.absentDays > 0
            ? Math.round((r.presentDays / (r.presentDays + r.absentDays)) * 1000) / 10
            : null,
        }));
        dailyRows = records;
      } else {
        const qIdx = Number(summaryQuarter);
        const q = qGroups[qIdx] || qGroups[0];
        label = `${q.label} ${year}`;
        badge = `${q.code} ${year}`;
        slug = `${year}-${q.code}`;
        summaryRows = (periodRows || []).map((r) => ({
          ...r,
          pct: r.presentDays + r.absentDays > 0
            ? Math.round((r.presentDays / (r.presentDays + r.absentDays)) * 1000) / 10
            : null,
        }));
        dailyRows = records.filter((r) => {
          const m = Number(r.date.split('-')[1]);
          return q.months.includes(m);
        });
      }
    } else if (periodView === 'halfyearly') {
      const hGroups = [
        { label: HALF_LABELS[0], code: 'H1', months: [1, 2, 3, 4, 5, 6] },
        { label: HALF_LABELS[1], code: 'H2', months: [7, 8, 9, 10, 11, 12] },
      ];
      if (summaryHalf === 'all') {
        label = `All Halves ${year}`;
        badge = `All Halves`;
        slug = `${year}-halfyearly-all`;
        summaryRows = (periodRows || []).map((r) => ({
          ...r,
          pct: r.presentDays + r.absentDays > 0
            ? Math.round((r.presentDays / (r.presentDays + r.absentDays)) * 1000) / 10
            : null,
        }));
        dailyRows = records;
      } else {
        const hIdx = Number(summaryHalf);
        const h = hGroups[hIdx] || hGroups[0];
        label = `${h.label} ${year}`;
        badge = `${h.code} ${year}`;
        slug = `${year}-${h.code}`;
        summaryRows = (periodRows || []).map((r) => ({
          ...r,
          pct: r.presentDays + r.absentDays > 0
            ? Math.round((r.presentDays / (r.presentDays + r.absentDays)) * 1000) / 10
            : null,
        }));
        dailyRows = records.filter((r) => {
          const m = Number(r.date.split('-')[1]);
          return h.months.includes(m);
        });
      }
    } else {
      label = `Annual ${year}`;
      badge = `Annual ${year}`;
      slug = `${year}-annual`;
      summaryRows = (periodRows || []).map((r) => ({
        ...r,
        pct: r.presentDays + r.absentDays > 0
          ? Math.round((r.presentDays / (r.presentDays + r.absentDays)) * 1000) / 10
          : null,
      }));
      dailyRows = records;
    }

    dailyRows = [...dailyRows].sort((a, b) => (a.date < b.date ? -1 : 1));

    const t = {
      p: 0,
      late: 0,
      a: 0,
      dutyHrs: 0,
      otHrs: 0,
      dutyWage: 0,
      otWage: 0,
      totalWage: 0,
      ml: 0,
      emg: 0,
      wr: 0,
      ca: 0,
      un: 0,
      us: 0,
      pct: null,
    };
    for (const r of summaryRows) {
      t.p += r.presentDays || 0;
      t.late += r.lateDays || 0;
      t.a += r.absentDays || 0;
      t.dutyHrs += r.totalDutyHours || 0;
      t.otHrs += r.totalOvertimeHours || 0;
      t.dutyWage += r.totalDailyWage || 0;
      t.otWage += r.totalOvertimeWage || 0;
      t.totalWage += r.totalWage != null ? r.totalWage : ((r.totalDailyWage || 0) + (r.totalOvertimeWage || 0));
      t.ml += r.ml || 0;
      t.emg += r.emergency || 0;
      t.wr += r.workRelated || 0;
      t.ca += r.casual || 0;
      t.un += r.unpaid || 0;
      t.us += r.unspecified || 0;
    }
    t.dutyHrs = Math.round(t.dutyHrs * 100) / 100;
    t.otHrs = Math.round(t.otHrs * 100) / 100;
    t.dutyWage = Math.round(t.dutyWage * 100) / 100;
    t.otWage = Math.round(t.otWage * 100) / 100;
    t.totalWage = Math.round(t.totalWage * 100) / 100;
    t.pct = t.p + t.a > 0 ? Math.round((t.p / (t.p + t.a)) * 1000) / 10 : null;

    return {
      label,
      badge,
      slug,
      summaryRows,
      dailyRows,
      totals: t,
    };
  })();

  const workerName = data?.worker?.name || '';

  const leaveCell = (v, k) => (
    <td key={k} className="num">
      {v ? <b style={{ color: LEAVE_COLORS[k] }}>{v}</b> : <span className="dim">–</span>}
    </td>
  );

  const threeMonths = getThreeMonths(calMonth);

  return (
    <div className="page dash-premium ad-page track-page">
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

      {/* Permanent Top-Right Sign Out Button */}
      <button className="top-signout-btn" onClick={onSignOut} title="Sign out of portal">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>Sign out</span>
      </button>

      {/* Back button */}
      <div className="track-back-row">
        <Link to="/admin" className="track-back-btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Admin Dashboard
        </Link>
      </div>

      {/* Floating Glass Header */}
      <header className="ad-header track-header">
        <div className="ad-header-left">
          <div className="ad-logo">▦</div>
          <div>
            <div className="ad-header-title">{workerName || 'Worker Track Record'}</div>
            <div className="ad-header-sub">Track Record · {data?.worker?.department || 'General'} · ID: {id}</div>
          </div>
        </div>
        <div className="ad-header-actions">
          <select className="ad-select" value={year} onChange={(e) => setYear(e.target.value)}>
            {years().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="theme-toggle" onClick={toggleTheme} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀' : '🌙'}</button>
        </div>
      </header>

      {err && <div className="error-msg">{err}</div>}
      {!data && !err ? (
        <div className="spin" />
      ) : data ? (
        <>
          <div className="ad-stats track-stats">
            <div className="ad-stat stat-attendance">
              <div className="ad-stat-glow" />
              <div className="ad-stat-inner">
                <div className="ad-stat-top">
                  <span className="ad-stat-label">Yearly Attendance Avg</span>
                  <span className="ad-stat-pill pill-cyan">{year}</span>
                </div>
                <div className="ad-stat-main">
                  <Ring value={yearPct ?? 0} max={100} color="#38BDF8" trackColor="rgba(255,255,255,0.08)" />
                  <div className="ad-stat-number">{yearPct != null ? `${yearPct}%` : '–'}</div>
                </div>
                <div className="ad-stat-sub">Annual average for {year}</div>
              </div>
            </div>

            <div className="ad-stat stat-workforce">
              <div className="ad-stat-glow" />
              <div className="ad-stat-inner">
                <div className="ad-stat-top">
                  <span className="ad-stat-label">Days Present</span>
                  <span className="ad-stat-pill pill-cyan">Present</span>
                </div>
                <div className="ad-stat-main">
                  <Ring value={tot.p} max={Math.max(tot.p + tot.a, 1)} color="#38BDF8" trackColor="rgba(255,255,255,0.08)" />
                  <div className="ad-stat-number">{tot.p}<span className="ad-stat-unit"> d</span></div>
                </div>
                <div className="ad-stat-sub">Total marked present in {year}</div>
              </div>
            </div>

            <div className="ad-stat stat-emergency">
              <div className="ad-stat-glow" />
              <div className="ad-stat-inner">
                <div className="ad-stat-top">
                  <span className="ad-stat-label">Days Absent</span>
                  <span className="ad-stat-pill pill-amber">Absent</span>
                </div>
                <div className="ad-stat-main">
                  <Ring value={tot.a} max={Math.max(tot.p + tot.a, 1)} color="#F59E0B" trackColor="rgba(255,255,255,0.08)" />
                  <div className="ad-stat-number">{tot.a}<span className="ad-stat-unit"> d</span></div>
                </div>
                <div className="ad-stat-sub">Leaves and unexcused absences</div>
              </div>
            </div>

            <div className="ad-stat stat-medical">
              <div className="ad-stat-glow" />
              <div className="ad-stat-inner">
                <div className="ad-stat-top">
                  <span className="ad-stat-label">Late Arrivals</span>
                  <span className="ad-stat-pill pill-amber">Late</span>
                </div>
                <div className="ad-stat-main">
                  <Ring value={tot.late} max={Math.max(tot.p, 1)} color="#F59E0B" trackColor="rgba(255,255,255,0.08)" />
                  <div className="ad-stat-number">{tot.late}<span className="ad-stat-unit"> d</span></div>
                </div>
                <div className="ad-stat-sub">Recorded arrival past shift start</div>
              </div>
            </div>
          </div>

          {avgArrival && (
            <div className="track-avg-banner">
              <div className="tab-icon">⏱</div>
              <div>
                <span className="tab-label">Average Arrival Time ({year}):</span>
                <strong className="tab-value">{avgArrival}</strong>
              </div>
            </div>
          )}

          <div className="ad-card-wrapper">
            <div className="ad-card-border-glow" aria-hidden="true" />
            <div className="ad-card-shine-line" aria-hidden="true" />
            <div className="ad-card-corner-blob" aria-hidden="true" />
            <div className="ad-card">
              <div className="ad-card-head">
                <div>
                  <h2 className="ad-card-title">Worker Profile & Compensation</h2>
                  <div className="ad-card-sub">Employment classification and wage configuration</div>
                </div>
                <span className={`ad-worker-badge ${data.worker.worker_type === 'contract' ? 'badge-contract' : 'badge-company'}`}>
                  {data.worker.worker_type === 'contract' ? 'Contract Worker' : 'Company Staff'}
                </span>
              </div>
              <div className="track-info-grid">
                <div className="track-info-item"><span className="tii-label">Full Name</span><span className="tii-value">{data.worker.name}</span></div>
                <div className="track-info-item"><span className="tii-label">Worker ID</span><span className="tii-value highlight-cyan">{data.worker.id}</span></div>
                <div className="track-info-item"><span className="tii-label">Department</span><span className="tii-value">{data.worker.department || '—'}</span></div>
                <div className="track-info-item"><span className="tii-label">Employment Type</span><span className="tii-value">{data.worker.worker_type === 'contract' ? 'Contract Worker' : 'Company Staff'}</span></div>
                {data.worker.designation && <div className="track-info-item"><span className="tii-label">Designation</span><span className="tii-value">{data.worker.designation}</span></div>}
                {data.worker.doj && <div className="track-info-item"><span className="tii-label">Date of Joining</span><span className="tii-value">{new Date(data.worker.doj + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>}
                {data.worker.worker_type === 'contract' ? (
                  <>
                    <div className="track-info-item"><span className="tii-label">Duty Rate / hr</span><span className="tii-value wage-green">AED {Number(data.worker.duty_rate_hr || 0).toFixed(2)}</span></div>
                    <div className="track-info-item"><span className="tii-label">Overtime Rate / hr</span><span className="tii-value wage-green">AED {Number(data.worker.ot_rate || 0).toFixed(2)}</span></div>
                  </>
                ) : (
                  <>
                    <div className="track-info-item"><span className="tii-label">Basic Salary</span><span className="tii-value wage-green">AED {Number(data.worker.basic_salary || 0).toLocaleString()}</span></div>
                    <div className="track-info-item"><span className="tii-label">Monthly Allowance</span><span className="tii-value wage-green">AED {Number(data.worker.allowance || 0).toLocaleString()}</span></div>
                    {Number(data.worker.ot_rate) > 0 && <div className="track-info-item"><span className="tii-label">Overtime Rate / hr</span><span className="tii-value wage-green">AED {Number(data.worker.ot_rate).toFixed(2)}</span></div>}
                  </>
                )}
              </div>
            </div>
          </div>

          {data.payroll && (data.payroll.dailyRate > 0 || data.payroll.basicSalary > 0) && (
            <div className="ad-card-wrapper">
              <div className="ad-card-border-glow" aria-hidden="true" />
              <div className="ad-card-shine-line" aria-hidden="true" />
              <div className="ad-card-corner-blob" aria-hidden="true" />
              <div className="ad-card">
                <div className="ad-card-head">
                  <div>
                    <h2 className="ad-card-title">Payroll Summary — {year}</h2>
                    <div className="ad-card-sub">Based on {data.payroll.basicSalary ? `basic AED ${data.payroll.basicSalary.toLocaleString()} + allowance AED ${data.payroll.allowance.toLocaleString()}` : `daily rate of AED ${data.payroll.dailyRate.toLocaleString()}`} and recorded attendance.</div>
                  </div>
                </div>
                <div className="track-payroll-grid">
                  <div className="track-payroll-item highlight">
                    <div className="tpi-label">Total Net Pay</div>
                    <div className="tpi-value">AED {data.payroll.net.toLocaleString()}</div>
                  </div>
                  <div className="track-payroll-item">
                    <div className="tpi-label">Duty Pay</div>
                    <div className="tpi-value">AED {data.payroll.totalDailyWage.toLocaleString()}</div>
                  </div>
                  <div className="track-payroll-item">
                    <div className="tpi-label">Overtime Pay</div>
                    <div className="tpi-value">AED {data.payroll.totalOvertimeWage.toLocaleString()}</div>
                  </div>
                  <div className="track-payroll-item">
                    <div className="tpi-label">Duty Hours</div>
                    <div className="tpi-value">{data.payroll.totalDutyHours}<span> hrs</span></div>
                  </div>
                  <div className="track-payroll-item">
                    <div className="tpi-label">Overtime Hours</div>
                    <div className="tpi-value">{data.payroll.totalOvertimeHours}<span> hrs</span></div>
                  </div>
                  <div className="track-payroll-item">
                    <div className="tpi-label">Paid Days</div>
                    <div className="tpi-value">{data.payroll.paidDays}<span> of {data.payroll.totalDays}</span></div>
                  </div>
                  <div className="track-payroll-item">
                    <div className="tpi-label">Unpaid Days</div>
                    <div className="tpi-value">{data.payroll.unpaidDays}<span> days</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Periodic Attendance & Wages Breakdown Table */}
          <div className="ad-card-wrapper">
            <div className="ad-card-border-glow" aria-hidden="true" />
            <div className="ad-card-shine-line" aria-hidden="true" />
            <div className="ad-card-corner-blob" aria-hidden="true" />
            <div className="ad-card">
              <div className="ad-card-head" style={{ flexWrap: 'wrap' }}>
                <div>
                  <h2 className="ad-card-title">{periodView === 'monthly' ? 'Monthly' : periodView === 'quarterly' ? 'Quarterly' : periodView === 'halfyearly' ? 'Half-yearly' : 'Annual'} Summary — {year}</h2>
                  <div className="ad-card-sub">Attendance, leave breakdown, and wages.{periodView === 'monthly' && ' Click a row to open that month in the calendar.'}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div className="seg period-seg">
                    {PERIOD_VIEWS.map((pv) => (
                      <button key={pv.key} className={periodView === pv.key ? 'on-p' : ''} onClick={() => setPeriodView(pv.key)}>{pv.label}</button>
                    ))}
                  </div>
                  {periodView === 'monthly' && (
                    <select className="ad-select" value={summaryMonth} onChange={(e) => setSummaryMonth(e.target.value)} style={{ minWidth: 120 }}>
                      <option value="all">All months</option>
                      {MONTHS.map((mn, i) => <option key={mn} value={String(i + 1).padStart(2, '0')}>{mn}</option>)}
                    </select>
                  )}
                  {periodView === 'quarterly' && (
                    <select className="ad-select" value={summaryQuarter} onChange={(e) => setSummaryQuarter(e.target.value)} style={{ minWidth: 140 }}>
                      <option value="all">All quarters</option>
                      {QUARTER_LABELS.map((ql, i) => <option key={ql} value={String(i)}>{ql}</option>)}
                    </select>
                  )}
                  {periodView === 'halfyearly' && (
                    <select className="ad-select" value={summaryHalf} onChange={(e) => setSummaryHalf(e.target.value)} style={{ minWidth: 130 }}>
                      <option value="all">All</option>
                      {HALF_LABELS.map((hl, i) => <option key={hl} value={String(i)}>{hl}</option>)}
                    </select>
                  )}
                  <div className="dl-wrap" ref={dlRef}>
                    <button type="button" className="ad-btn dl-btn-accent" onClick={() => setShowDlMenu((v) => !v)}>
                      ⬇ Download {activePeriodInfo.badge} Report <span className="dl-caret">▾</span>
                    </button>
                    {showDlMenu && (
                      <div className="ad-dl-menu">
                        <button type="button" onClick={() => { generateFilteredCSV(data, year, id, activePeriodInfo); setShowDlMenu(false); }}>
                          ⬇ CSV Summary & Logs ({activePeriodInfo.badge})
                        </button>
                        <button type="button" onClick={() => { generateFilteredPDF(data, year, id, activePeriodInfo); setShowDlMenu(false); }}>
                          📄 PDF Report ({activePeriodInfo.badge})
                        </button>
                        <button type="button" onClick={() => { generateFilteredXLSX(data, year, id, activePeriodInfo); setShowDlMenu(false); }}>
                          📊 Excel (XLSX) ({activePeriodInfo.badge})
                        </button>
                        <button type="button" onClick={() => { setShowPayslip(true); setShowDlMenu(false); }}>
                          💵 Pay Slip (PDF)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="ad-table-container">
                <table className="tbl month-tbl">
                  <thead>
                    <tr>
                      <th rowSpan={2} className="corner">Period</th>
                      <th colSpan={4} className="grp">Attendance</th>
                      <th colSpan={4} className="grp soft">Wages (AED)</th>
                      <th colSpan={6} className="grp soft">Leave days by type</th>
                    </tr>
                    <tr>
                      <th className="num">Present</th>
                      <th className="num">Late</th>
                      <th className="num">Absent</th>
                      <th className="num">Avg %</th>
                      <th className="num">Duty hrs</th>
                      <th className="num">OT hrs</th>
                      <th className="num">Duty pay</th>
                      <th className="num">OT pay</th>
                      {LEAVE_KEYS.map((k) => (
                        <th key={k} className="num">
                          <span className="ldot" style={{ background: LEAVE_COLORS[k] }} />
                          {LEAVE_SHORT[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periodView === 'monthly' ? (
                      monthsWithData.filter(({ i }) => summaryMonth === 'all' || String(i + 1).padStart(2, '0') === summaryMonth).map(({ mn, i, s }) => {
                        const pct = monthPct(s);
                        const counts = { ml: s.ml, emergency: s.emergency, work_related: s.workRelated, casual: s.casual, unpaid: s.unpaid, unspecified: s.unspecified };
                        return (
                          <tr key={mn} className="clickrow" onClick={() => setCalMonth(i + 1)}>
                            <td className="name">{mn}</td>
                            <td className="num">{s.presentDays}</td>
                            <td className="num" style={{ color: (s.lateDays || 0) ? '#F59E0B' : 'inherit' }}>{s.lateDays || '–'}</td>
                            <td className="num warn-num">{s.absentDays}</td>
                            <td className="num">{pct != null && <span className={`pct ${pct < 80 ? 'low' : ''}`}>{pct}%</span>}</td>
                            <td className="num">{s.totalDutyHours || '–'}</td>
                            <td className="num">{s.totalOvertimeHours || '–'}</td>
                            <td className="num">{s.totalDailyWage ? fmtAED(s.totalDailyWage) : '–'}</td>
                            <td className="num">{s.totalOvertimeWage ? fmtAED(s.totalOvertimeWage) : '–'}</td>
                            {LEAVE_KEYS.map((k) => leaveCell(counts[k], k))}
                          </tr>
                        );
                      })
                    ) : (
                      (periodRows || []).map((row) => {
                        const pct = row.presentDays + row.absentDays > 0
                          ? Math.round((row.presentDays / (row.presentDays + row.absentDays)) * 1000) / 10
                          : null;
                        const counts = { ml: row.ml, emergency: row.emergency, work_related: row.workRelated, casual: row.casual, unpaid: row.unpaid, unspecified: row.unspecified };
                        return (
                          <tr key={row.label}>
                            <td className="name">{row.label}</td>
                            <td className="num">{row.presentDays}</td>
                            <td className="num" style={{ color: row.lateDays ? '#F59E0B' : 'inherit' }}>{row.lateDays || '–'}</td>
                            <td className="num warn-num">{row.absentDays}</td>
                            <td className="num">{pct != null && <span className={`pct ${pct < 80 ? 'low' : ''}`}>{pct}%</span>}</td>
                            <td className="num">{row.totalDutyHours || '–'}</td>
                            <td className="num">{row.totalOvertimeHours || '–'}</td>
                            <td className="num">{row.totalDailyWage ? fmtAED(row.totalDailyWage) : '–'}</td>
                            <td className="num">{row.totalOvertimeWage ? fmtAED(row.totalOvertimeWage) : '–'}</td>
                            {LEAVE_KEYS.map((k) => leaveCell(counts[k], k))}
                          </tr>
                        );
                      })
                    )}
                    {((periodView === 'monthly' && monthsWithData.length === 0) || (periodView !== 'monthly' && (!periodRows || periodRows.length === 0))) && (
                      <tr>
                        <td colSpan={15} className="muted empty-row">No attendance marked yet for {year}.</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="name">{activePeriodInfo.badge} Total</td>
                      <td className="num">{activePeriodInfo.totals?.p ?? 0}</td>
                      <td className="num" style={{ color: activePeriodInfo.totals?.late ? '#F59E0B' : 'inherit' }}>{activePeriodInfo.totals?.late || '–'}</td>
                      <td className="num warn-num">{activePeriodInfo.totals?.a ?? 0}</td>
                      <td className="num">{activePeriodInfo.totals?.pct != null && <span className={`pct ${activePeriodInfo.totals.pct < 80 ? 'low' : ''}`}>{activePeriodInfo.totals.pct}%</span>}</td>
                      <td className="num">{activePeriodInfo.totals?.dutyHrs ? activePeriodInfo.totals.dutyHrs.toFixed(1) : '–'}</td>
                      <td className="num">{activePeriodInfo.totals?.otHrs ? activePeriodInfo.totals.otHrs.toFixed(1) : '–'}</td>
                      <td className="num">{fmtAED(activePeriodInfo.totals?.dutyWage)}</td>
                      <td className="num">{fmtAED(activePeriodInfo.totals?.otWage)}</td>
                      {LEAVE_KEYS.map((k) => leaveCell(activePeriodInfo.totals ? activePeriodInfo.totals[k === 'emergency' ? 'emg' : k === 'work_related' ? 'wr' : k === 'casual' ? 'ca' : k === 'unpaid' ? 'un' : k === 'unspecified' ? 'us' : k] : 0, k))}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="tbl-note" style={{ color: '#94A3B8', marginTop: 14 }}>
                {monthsWithData.length} of 12 months have marked records. Leave colours match the calendar below.
              </div>
            </div>
          </div>

          {/* Interactive Calendar Card */}
          <div className="ad-card-wrapper">
            <div className="ad-card-border-glow" aria-hidden="true" />
            <div className="ad-card-shine-line" aria-hidden="true" />
            <div className="ad-card-corner-blob" aria-hidden="true" />
            <div className="ad-card">
              <div className="ad-card-head">
                <div>
                  <h2 className="ad-card-title">
                    Calendar & Logs — {calView === 1
                      ? `${MONTHS[calMonth - 1]} ${year}`
                      : `${MONTHS[threeMonths[0] - 1]}–${MONTHS[threeMonths[2] - 1]} ${year}`}
                  </h2>
                  <div className="ad-card-sub">Absent days are highlighted in leave colors — hover over any day for recorded timestamps.</div>
                </div>
                <div className="cal-controls">
                  <div className="seg">
                    <button className={calView === 1 ? 'on-p' : ''} onClick={() => setCalView(1)}>1 month</button>
                    <button className={calView === 3 ? 'on-p' : ''} onClick={() => setCalView(3)}>3 months</button>
                  </div>
                  {calView === 1 && (
                    <select className="ad-select" value={calMonth} onChange={(e) => setCalMonth(Number(e.target.value))}>
                      {MONTHS.map((mn, i) => <option key={mn} value={i + 1}>{mn}</option>)}
                    </select>
                  )}
                  {calView === 3 && (
                    <div className="cal-nav">
                      <button
                        className="ad-btn ad-btn-ghost"
                        disabled={threeMonths[0] <= 1}
                        onClick={() => setCalMonth((m) => Math.max(1, m - 3))}
                      >←</button>
                      <button
                        className="ad-btn ad-btn-ghost"
                        disabled={threeMonths[2] >= 12}
                        onClick={() => setCalMonth((m) => Math.min(12, m + 3))}
                      >→</button>
                    </div>
                  )}
                </div>
              </div>

              {calView === 1 ? (
                <div className="cal">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="hd">{d}</div>)}
                  {[...CalendarCells(calMonth, year, recordsMap, todayIso, holidayMap)]}
                </div>
              ) : (
                <div className="three-cal">
                  {threeMonths.map((m) => (
                    <div key={m} className="three-cal-month">
                      <div className="three-cal-label">{MONTHS[m - 1]}</div>
                      <div className="cal cal-sm">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="hd">{d}</div>)}
                        {[...CalendarCells(m, year, recordsMap, todayIso, holidayMap)]}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="cal-legend">
                <span className="lgd"><span className="swc present-sw" />Present</span>
                <span className="lgd"><span className="swc" style={{ background: '#F59E0B' }} />Late Present</span>
                {LEAVE_KEYS.map((k) => (
                  <span key={k} className="lgd">
                    <span className="swc" style={{ background: LEAVE_COLORS[k] }} />{LEAVE_LABELS[k]}
                  </span>
                ))}
                <span className="lgd"><span className="swc" style={{ background: '#F59E0B' }} />Govt Holiday</span>
                <span className="lgd"><span className="swc" style={{ background: '#6366F1' }} />Company Off</span>
                <span className="lgd"><span className="swc none-sw" />No record</span>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {showPayslip && (
        <div className="overlay" onClick={() => setShowPayslip(false)}>
          <div className="modal ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3>Generate Pay Slip</h3>
            <div className="msub">Select a month to generate an official salary pay slip PDF for {data?.worker?.name || 'this worker'}.</div>
            <div className="field" style={{ marginTop: 16 }}>
              <label>Select Month</label>
              <select className="ad-select" style={{ width: '100%' }} value={payslipMonth} onChange={(e) => setPayslipMonth(e.target.value)}>
                {MONTHS.map((mn, i) => <option key={mn} value={String(i + 1).padStart(2, '0')}>{mn} {year}</option>)}
              </select>
            </div>
            <div className="modal-actions" style={{ marginTop: 22 }}>
              <button type="button" className="btn ghost" onClick={() => setShowPayslip(false)}>Cancel</button>
              <button className="ad-btn-primary" disabled={genPS} onClick={async () => {
                setGenPS(true);
                try { await generatePaySlip(id, year, payslipMonth); } catch (e) { alert(e.message); }
                setGenPS(false);
                setShowPayslip(false);
              }}>
                <span className="ad-btn-primary-inner">{genPS ? 'Generating…' : '⬇ Download Pay Slip'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tip({ children, text }) {
  return (
    <div className="tt-wrap">
      {children}
      <div className="tt-content">{text}</div>
    </div>
  );
}

function CalendarCells(month, year, recordsMap, todayIso, holidayMap = {}) {
  const y = Number(year);
  const m = Number(month) - 1;
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(<div key={`e${i}`} className="cell empty" />);
  const [y0, m0] = [String(y), String(month).padStart(2, '0')];
  for (let d = 1; d <= days; d++) {
    const iso = `${y0}-${m0}-${String(d).padStart(2, '0')}`;
    const r = recordsMap[iso];
    const hol = holidayMap[iso];

    const holLabel = hol ? (hol.type === 'company' ? `Company Off: ${hol.name}` : `Holiday: ${hol.name}`) : '';
    const holCls = hol ? (hol.type === 'company' ? 'holiday-company' : 'holiday') : '';

    if (!r) {
      const tipText = hol ? `${iso} — ${holLabel}` : iso > todayIso ? `${iso} — not recorded yet` : `${iso} — no record`;
      cells.push(
        <Tip key={iso} text={tipText}>
          <div className={`cell${hol ? ` ${holCls}` : ' none'}${iso > todayIso ? ' future' : ''}`}>
            <span className="mark">{d}</span>
          </div>
        </Tip>,
      );
      continue;
    }

    if (r.status === 'absent') {
      const type = r.leave_type && LEAVE_META[r.leave_type] ? r.leave_type : 'unspecified';
      const [label, color] = LEAVE_META[type];
      const absentTime = r.recorded_at ? ` · ${new Date(r.recorded_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : '';
      const tipText = `${iso} — Absent · ${label}${r.notes ? ` · ${r.notes}` : ''}${absentTime}${holLabel ? ` · ${holLabel}` : ''}`;
      cells.push(
        <Tip key={iso} text={tipText}>
          <div
            className="cell absent"
            style={{ background: `${color}1E`, borderColor: `${color}55` }}
          >
            <span className="mark" style={{ background: color, color: '#FFFFFF', boxShadow: `0 0 10px ${color}88`, fontWeight: 700 }}>{d}</span>
          </div>
        </Tip>,
      );
      continue;
    }

    const timeStr = r.recorded_at ? ` · ${new Date(r.recorded_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : '';
    const isLate = r.is_late;
    const tipText = `${iso} — ${isLate ? 'Late Present' : 'Present'}${timeStr}${holLabel ? ` · ${holLabel}` : ''}`;
    cells.push(
      <Tip key={iso} text={tipText}>
        <div className={`cell present${isLate ? ' late' : ''}`}
          style={isLate ? { background: 'rgba(245, 158, 11, 0.18)', borderColor: 'rgba(245, 158, 11, 0.5)' } : undefined}
        >
          <span className="mark" style={isLate ? { background: 'linear-gradient(135deg, #D97706, #F59E0B)', color: '#FFFFFF', boxShadow: '0 0 10px rgba(245, 158, 11, 0.5)' } : undefined}>{d}</span>
        </div>
      </Tip>,
    );
  }
  return cells;
}

function years() {
  const y = new Date().getFullYear();
  return [y + 1, y, y - 1, y - 2];
}
