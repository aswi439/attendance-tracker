import React, { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatExperience } from '../api.js';
import { useTheme } from '../App.jsx';
import Ring from '../Ring.jsx';
import { GlassFold } from '@/components/ui/glass-fold';
import TeamLanyardRail from '@/components/ui/team-lanyard-rail';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const LEAVE_META = {
  ml: ['Medical Leave', '#E45863'],
  annual: ['Annual Leave', '#0284C7'],
  emergency: ['Emergency', '#D97706'],
  work_related: ['Work-related', '#8B7CF6'],
  casual: ['Casual', '#E8C56B'],
  unpaid: ['Unpaid', '#8E9BB3'],
  unspecified: ['Unspecified', '#64C7A9'],
};
const LEAVE_KEYS = Object.keys(LEAVE_META);
const LEAVE_COLORS = Object.fromEntries(LEAVE_KEYS.map((k) => [k, LEAVE_META[k][1]]));
const LEAVE_LABELS = Object.fromEntries(LEAVE_KEYS.map((k) => [k, LEAVE_META[k][0]]));
const LEAVE_SHORT = { ml: 'ML', annual: 'Annual', emergency: 'Emer.', work_related: 'Work', casual: 'Casual', unpaid: 'Unpaid', unspecified: 'Unspec.' };

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
  const sumHeaders = ['Period', 'Present', 'Late', 'Absent', 'No Work', 'Avg %', 'Duty Hrs', 'OT Hrs', 'Duty Pay/Hr', 'OT Pay/Hr', 'Duty Pay', 'OT Pay', 'Addl. Allow', 'Total Wages', 'ML', 'Annual', 'Emg', 'Work', 'Cas', 'Unp'];
  const sumData = (summaryRows || []).map((r) => [
    r.label,
    r.presentDays ?? 0,
    r.lateDays ?? 0,
    r.absentDays ?? 0,
    r.noWorkDays ?? 0,
    r.pct != null ? `${r.pct}%` : '–',
    r.totalDutyHours ?? 0,
    r.totalOvertimeHours ?? 0,
    r.totalDutyHours > 0 ? `AED ${((r.totalDailyWage || 0) / r.totalDutyHours).toFixed(2)}` : '–',
    r.totalOvertimeHours > 0 ? `AED ${((r.totalOvertimeWage || 0) / r.totalOvertimeHours).toFixed(2)}` : '–',
    r.totalDailyWage ? `AED ${Number(r.totalDailyWage).toFixed(2)}` : '–',
    r.totalOvertimeWage ? `AED ${Number(r.totalOvertimeWage).toFixed(2)}` : '–',
    worker.additional_allowance ? `AED ${Number(worker.additional_allowance).toFixed(2)}` : '–',
    r.totalWage ? `AED ${Number(r.totalWage).toFixed(2)}` : (r.totalDailyWage || r.totalOvertimeWage ? `AED ${(Number(r.totalDailyWage || 0) + Number(r.totalOvertimeWage || 0)).toFixed(2)}` : '–'),
    r.ml ?? 0,
    r.annual ?? 0,
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
      totals.noWork ?? 0,
      totals.pct != null ? `${totals.pct}%` : '–',
      totals.dutyHrs ?? 0,
      totals.otHrs ?? 0,
      totals.dutyHrs > 0 ? `AED ${((totals.dutyWage || 0) / totals.dutyHrs).toFixed(2)}` : '–',
      totals.otHrs > 0 ? `AED ${((totals.otWage || 0) / totals.otHrs).toFixed(2)}` : '–',
      totals.dutyWage ? `AED ${Number(totals.dutyWage).toFixed(2)}` : '–',
      totals.otWage ? `AED ${Number(totals.otWage).toFixed(2)}` : '–',
      worker.additional_allowance ? `AED ${(Number(worker.additional_allowance) * (summaryRows || []).length).toFixed(2)}` : '–',
      totals.totalWage ? `AED ${Number(totals.totalWage).toFixed(2)}` : '–',
      totals.ml ?? 0,
      totals.ann ?? 0,
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
    r.site || '–',
    r.status === 'present' ? (r.ot_type === 'sunday' ? 'Sunday OT' : r.ot_type === 'holiday' ? 'Holiday OT' : (r.is_late ? 'Late' : 'Present')) : (r.status === 'no_work' ? 'No Work' : 'Absent'),
    r.duty_hours ? `${r.duty_hours}h` : '–',
    r.overtime_hours ? `${r.overtime_hours}h` : '–',
    r.daily_wage ? `AED ${Number(r.daily_wage).toFixed(2)}` : '–',
    r.overtime_wage ? `AED ${Number(r.overtime_wage).toFixed(2)}` : '–',
    r.leave_type ? (LEAVE_LABELS[r.leave_type] || r.leave_type) : '–',
    r.notes || '',
  ]);

  autoTable(doc, {
    startY: finalY + 4,
    head: [['Date', 'Day', 'Site', 'Status', 'Duty', 'OT', 'Duty Pay', 'OT Pay', 'Leave Type', 'Notes']],
    body: dailyData.length > 0 ? dailyData : [['–', '–', '–', 'No daily records in this period', '–', '–', '–', '–', '–', '–']],
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
    'No Work Days': r.noWorkDays ?? 0,
    'Attendance %': r.pct != null ? `${r.pct}%` : '–',
    'Duty Hours': r.totalDutyHours ?? 0,
    'OT Hours': r.totalOvertimeHours ?? 0,
    'Duty Pay/Hr (AED)': r.totalDutyHours > 0 ? Math.round(((r.totalDailyWage || 0) / r.totalDutyHours) * 100) / 100 : 0,
    'OT Pay/Hr (AED)': r.totalOvertimeHours > 0 ? Math.round(((r.totalOvertimeWage || 0) / r.totalOvertimeHours) * 100) / 100 : 0,
    'Duty Pay (AED)': r.totalDailyWage ?? 0,
    'OT Pay (AED)': r.totalOvertimeWage ?? 0,
    'Addl. Allowance (AED)': data?.worker?.additional_allowance ?? 0,
    'Total Wages (AED)': r.totalWage ?? (Number(r.totalDailyWage || 0) + Number(r.totalOvertimeWage || 0)),
    'Medical Leave': r.ml ?? 0,
    'Annual Leave': r.annual ?? 0,
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
      'No Work Days': totals.noWork ?? 0,
      'Attendance %': totals.pct != null ? `${totals.pct}%` : '–',
      'Duty Hours': totals.dutyHrs ?? 0,
      'OT Hours': totals.otHrs ?? 0,
      'Duty Pay/Hr (AED)': totals.dutyHrs > 0 ? Math.round(((totals.dutyWage || 0) / totals.dutyHrs) * 100) / 100 : 0,
      'OT Pay/Hr (AED)': totals.otHrs > 0 ? Math.round(((totals.otWage || 0) / totals.otHrs) * 100) / 100 : 0,
      'Duty Pay (AED)': totals.dutyWage ?? 0,
      'OT Pay (AED)': totals.otWage ?? 0,
      'Addl. Allowance (AED)': (data?.worker?.additional_allowance ?? 0) * (summaryRows || []).length,
      'Total Wages (AED)': totals.totalWage ?? 0,
      'Medical Leave': totals.ml ?? 0,
      'Annual Leave': totals.ann ?? 0,
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
    Site: r.site || '–',
    Status: r.status === 'present' ? (r.ot_type === 'sunday' ? 'Sunday OT' : r.ot_type === 'holiday' ? 'Holiday OT' : (r.is_late ? 'Late Present' : 'Present')) : (r.status === 'no_work' ? 'No Work' : 'Absent'),
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
    'Period,Present Days,Late Days,Absent Days,No Work Days,Attendance %,Duty Hours,OT Hours,Duty Pay/Hr (AED),OT Pay/Hr (AED),Duty Pay (AED),OT Pay (AED),Addl. Allowance (AED),Total Wages (AED),Medical Leave,Annual Leave,Emergency,Work-related,Casual,Unpaid,Unspecified',
    ...(summaryRows || []).map((r) =>
      [
        r.label,
        r.presentDays ?? 0,
        r.lateDays ?? 0,
        r.absentDays ?? 0,
        r.noWorkDays ?? 0,
        r.pct != null ? `${r.pct}%` : '–',
        r.totalDutyHours ?? 0,
        r.totalOvertimeHours ?? 0,
        r.totalDutyHours > 0 ? ((r.totalDailyWage || 0) / r.totalDutyHours).toFixed(2) : 0,
        r.totalOvertimeHours > 0 ? ((r.totalOvertimeWage || 0) / r.totalOvertimeHours).toFixed(2) : 0,
        r.totalDailyWage ?? 0,
        r.totalOvertimeWage ?? 0,
        worker.additional_allowance ?? 0,
        r.totalWage ?? (Number(r.totalDailyWage || 0) + Number(r.totalOvertimeWage || 0)),
        r.ml ?? 0,
        r.annual ?? 0,
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
      totals.noWork ?? 0,
      totals.pct != null ? `${totals.pct}%` : '–',
      totals.dutyHrs ?? 0,
      totals.otHrs ?? 0,
      totals.dutyHrs > 0 ? ((totals.dutyWage || 0) / totals.dutyHrs).toFixed(2) : 0,
      totals.otHrs > 0 ? ((totals.otWage || 0) / totals.otHrs).toFixed(2) : 0,
      totals.dutyWage ?? 0,
      totals.otWage ?? 0,
      (worker.additional_allowance ?? 0) * (summaryRows || []).length,
      totals.totalWage ?? 0,
      totals.ml ?? 0,
      totals.ann ?? 0,
      totals.emg ?? 0,
      totals.wr ?? 0,
      totals.ca ?? 0,
      totals.un ?? 0,
      totals.us ?? 0,
    ].map(csvEscape).join(','));
  }

  lines.push('');
  lines.push(`--- DAILY ATTENDANCE RECORDS (${label}) ---`);
  lines.push('Date,Day,Site,Status,Duty Hours,OT Hours,Duty Pay (AED),OT Pay (AED),Leave Type,Notes,Marked By');

  const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const r of dailyRows || []) {
    lines.push([
      r.date,
      dow[new Date(r.date + 'T00:00:00Z').getUTCDay()],
      r.site || '–',
      r.status === 'present' ? (r.ot_type === 'sunday' ? 'Sunday OT' : r.ot_type === 'holiday' ? 'Holiday OT' : (r.is_late ? 'Late Present' : 'Present')) : (r.status === 'no_work' ? 'No Work' : 'Absent'),
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
    const agg = { label, presentDays: 0, lateDays: 0, absentDays: 0, noWorkDays: 0, ml: 0, annual: 0, emergency: 0, workRelated: 0, casual: 0, unpaid: 0, unspecified: 0, totalDutyHours: 0, totalOvertimeHours: 0, sundayOtHours: 0, holidayOtHours: 0, totalDailyWage: 0, totalOvertimeWage: 0, totalWage: 0, hasData: false };
    for (const m of mlist) {
      const mm = monthly.find((r) => r.month === String(m).padStart(2, '0'));
      if (!mm) continue;
      agg.hasData = true;
      agg.presentDays += mm.presentDays;
      agg.lateDays += mm.lateDays || 0;
      agg.absentDays += mm.absentDays;
      agg.noWorkDays += mm.noWorkDays || 0;
      agg.ml += mm.ml;
      agg.annual += (mm.annual || 0);
      agg.emergency += mm.emergency;
      agg.workRelated += mm.workRelated;
      agg.casual += mm.casual;
      agg.unpaid += mm.unpaid;
      agg.unspecified += mm.unspecified;
      agg.totalDutyHours += mm.totalDutyHours || 0;
      agg.totalOvertimeHours += mm.totalOvertimeHours || 0;
      agg.sundayOtHours += mm.sundayOtHours || 0;
      agg.holidayOtHours += mm.holidayOtHours || 0;
      agg.totalDailyWage += mm.totalDailyWage || 0;
      agg.totalOvertimeWage += mm.totalOvertimeWage || 0;
      agg.totalWage += mm.totalWage || 0;
    }
    agg.totalDutyHours = Math.round(agg.totalDutyHours * 100) / 100;
    agg.totalOvertimeHours = Math.round(agg.totalOvertimeHours * 100) / 100;
    agg.sundayOtHours = Math.round((agg.sundayOtHours || 0) * 100) / 100;
    agg.holidayOtHours = Math.round((agg.holidayOtHours || 0) * 100) / 100;
    agg.totalDailyWage = Math.round(agg.totalDailyWage * 100) / 100;
    agg.totalOvertimeWage = Math.round(agg.totalOvertimeWage * 100) / 100;
    agg.totalWage = Math.round(agg.totalWage * 100) / 100;
    return agg;
  });
}

function fmtAED(v) { return v ? `AED ${v.toLocaleString()}` : '–'; }

function renderOtCell(totalOt, sunOt, holOt) {
  if (!totalOt) return '–';
  const hasSpecial = (sunOt > 0 || holOt > 0);
  if (!hasSpecial) return totalOt;
  const regOt = Math.max(0, totalOt - (sunOt || 0) - (holOt || 0));
  const parts = [];
  if (regOt > 0) parts.push(`${regOt.toFixed(1)}h regular OT`);
  if (sunOt > 0) parts.push(`${sunOt.toFixed(1)}h Sunday OT`);
  if (holOt > 0) parts.push(`${holOt.toFixed(1)}h Holiday OT`);
  const tip = parts.join(' + ') || `${totalOt}h OT`;
  return (
    <Tip text={tip}>
      <span style={{ borderBottom: '1px dotted rgba(56, 189, 248, 0.75)', cursor: 'help' }}>
        {typeof totalOt === 'number' ? (Number.isInteger(totalOt) ? totalOt : totalOt.toFixed(1)) : totalOt}
      </span>
    </Tip>
  );
}

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
      p: a.p + r.presentDays, late: a.late + (r.lateDays || 0), a: a.a + r.absentDays,
      noWork: a.noWork + (r.noWorkDays || 0),
      ml: a.ml + r.ml,
      ann: a.ann + (r.annual || 0),
      emg: a.emg + r.emergency, wr: a.wr + r.workRelated, ca: a.ca + r.casual,
      un: a.un + r.unpaid, us: a.us + r.unspecified,
    }),
    { p: 0, late: 0, a: 0, noWork: 0, ml: 0, ann: 0, emg: 0, wr: 0, ca: 0, un: 0, us: 0 },
  );
  const yearPct = tot.p + tot.a > 0 ? Math.round((tot.p / (tot.p + tot.a)) * 1000) / 10 : null;

  const payroll = data?.payroll || (() => {
    if (!data?.records || !data?.worker) return null;
    const paidLeaves = ['ml', 'annual', 'casual', 'emergency', 'work_related'];
    let paidDays = 0;
    let unpaidDays = 0;
    let totalDutyHours = 0;
    let totalOvertimeHours = 0;
    let totalDailyWage = 0;
    let totalOvertimeWage = 0;
    for (const r of data.records) {
      if (r.status === 'present') {
        paidDays++;
        totalDutyHours += Number(r.duty_hours) || 0;
        totalOvertimeHours += Number(r.overtime_hours) || 0;
        totalDailyWage += Number(r.daily_wage) || 0;
        totalOvertimeWage += Number(r.overtime_wage) || 0;
      } else if (r.status === 'absent' && paidLeaves.includes(r.leave_type)) {
        paidDays++;
      } else if (r.status === 'no_work') {
        unpaidDays++;
      } else {
        unpaidDays++;
      }
    }
    return {
      dailyRate: data.worker.daily_rate || 0,
      basicSalary: data.worker.basic_salary || 0,
      allowance: data.worker.allowance || 0,
      otRate: data.worker.ot_rate || 0,
      dutyRateHr: data.worker.duty_rate_hr || 0,
      paidDays,
      unpaidDays,
      totalDays: paidDays + unpaidDays,
      totalDutyHours: Math.round(totalDutyHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      totalDailyWage: Math.round(totalDailyWage * 100) / 100,
      totalOvertimeWage: Math.round(totalOvertimeWage * 100) / 100,
      net: Math.round((totalDailyWage + totalOvertimeWage) * 100) / 100,
    };
  })();

  const totalPayrollHours = payroll ? Math.round(((Number(payroll.totalDutyHours) || 0) + (Number(payroll.totalOvertimeHours) || 0)) * 100) / 100 : 0;
  const dutyPayPct = payroll && payroll.net > 0 ? Math.round(((Number(payroll.totalDailyWage) || 0) / payroll.net) * 100) : 0;
  const otPayPct = payroll && payroll.net > 0 ? Math.max(0, 100 - dutyPayPct) : 0;
  const paidDaysPct = payroll && (payroll.totalDays || 0) > 0 ? Math.round((payroll.paidDays / payroll.totalDays) * 100) : 0;
  const dutyHoursPct = totalPayrollHours > 0 ? Math.round(((Number(payroll?.totalDutyHours) || 0) / totalPayrollHours) * 100) : 0;
  const otHoursPct = totalPayrollHours > 0 ? Math.max(0, 100 - dutyHoursPct) : 0;
  const avgDailyEarn = payroll && payroll.paidDays > 0 ? (payroll.net / payroll.paidDays).toFixed(2) : '0.00';
  const effectiveHrYield = totalPayrollHours > 0 && payroll ? (payroll.net / totalPayrollHours).toFixed(2) : '0.00';

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawDataUrl = ev.target.result;
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
        } else {
          if (h > maxDim) { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const optimized = canvas.toDataURL('image/jpeg', 0.85);

        try {
          await api.updateWorker(id, { photo: optimized });
          setData((prev) => prev ? { ...prev, worker: { ...prev.worker, photo: optimized } } : prev);
        } catch (err) {
          console.error('Failed to save worker photo', err);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async (e) => {
    e?.stopPropagation?.();
    try {
      await api.updateWorker(id, { photo: null });
      setData((prev) => prev ? { ...prev, worker: { ...prev.worker, photo: null } } : prev);
    } catch (err) {
      console.error('Failed to remove photo', err);
    }
  };

  const pastMonthWorkLine = (() => {
    if (!monthly || monthly.length === 0) return 'Regular attendance shifts verified and in good standing.';
    const recents = [...monthly].filter(m => m.presentDays > 0 || m.absentDays > 0);
    if (!recents.length) return 'Ready for active assignment · Record in good standing.';
    const lastM = recents[recents.length - 1];
    const mName = MONTHS[Number(lastM.month) - 1] || `Month ${lastM.month}`;
    const dutyHrs = Math.round(lastM.totalDutyHours || 0);
    const otHrs = Math.round(lastM.totalOvertimeHours || 0);
    const totalWage = Math.round(lastM.totalWage || 0);
    return `${mName}: ${lastM.presentDays} days on duty · ${dutyHrs}h duty + ${otHrs}h OT · Wages AED ${totalWage.toLocaleString()}`;
  })();

  const singleLanyardItem = data?.worker ? [
    {
      id: String(data.worker.id),
      workerId: String(data.worker.id),
      name: data.worker.name,
      role: data.worker.designation || (data.worker.worker_type === 'contract' ? 'External Contractor' : 'Company Staff'),
      designation: data.worker.designation || (data.worker.worker_type === 'contract' ? 'External Contractor' : 'Company Staff'),
      department: data.worker.department || 'General',
      workerType: data.worker.worker_type,
      doj: data.worker.doj || null,
      experience: formatExperience(data.worker.doj, data.worker.worker_type, data.worker.department),
      tone: (data.worker.worker_type === 'contract' ? 3 : 2),
      image: data.worker.photo || '',
      pastMonthWork: pastMonthWorkLine,
      basicSalary: data.worker.basic_salary,
      allowance: data.worker.allowance,
      dutyRateHr: data.worker.duty_rate_hr,
      otRate: data.worker.ot_rate,
      isEmployeeIdCard: true,
      onPhotoUpload: handlePhotoUpload,
      onRemovePhoto: handleRemovePhoto,
    },
  ] : [];

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
          noWorkDays: 0,
          pct: null,
          totalDutyHours: 0,
          totalOvertimeHours: 0,
          totalDailyWage: 0,
          totalOvertimeWage: 0,
          totalWage: 0,
          ml: 0,
          annual: 0,
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
      noWork: 0,
      dutyHrs: 0,
      otHrs: 0,
      sundayOtHours: 0,
      holidayOtHours: 0,
      dutyWage: 0,
      otWage: 0,
      totalWage: 0,
      ml: 0,
      ann: 0,
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
      t.noWork += r.noWorkDays || 0;
      t.dutyHrs += r.totalDutyHours || 0;
      t.otHrs += r.totalOvertimeHours || 0;
      t.sundayOtHours += r.sundayOtHours || 0;
      t.holidayOtHours += r.holidayOtHours || 0;
      t.dutyWage += r.totalDailyWage || 0;
      t.otWage += r.totalOvertimeWage || 0;
      t.totalWage += r.totalWage != null ? r.totalWage : ((r.totalDailyWage || 0) + (r.totalOvertimeWage || 0));
      t.ml += r.ml || 0;
      t.ann += r.annual || 0;
      t.emg += r.emergency || 0;
      t.wr += r.workRelated || 0;
      t.ca += r.casual || 0;
      t.un += r.unpaid || 0;
      t.us += r.unspecified || 0;
    }
    t.dutyHrs = Math.round(t.dutyHrs * 100) / 100;
    t.otHrs = Math.round(t.otHrs * 100) / 100;
    t.sundayOtHours = Math.round(t.sundayOtHours * 100) / 100;
    t.holidayOtHours = Math.round(t.holidayOtHours * 100) / 100;
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

          {/* Middle Section: Left = Payroll Summary Info, Right = Interactive Employee ID Card with sliding animation */}
          <div className="track-mid-layout">
            <div className="track-mid-payroll">
              {payroll && (
                <div className="ad-card-wrapper" style={{ height: '100%' }}>
                  <div className="ad-card-border-glow" aria-hidden="true" />
                  <div className="ad-card-shine-line" aria-hidden="true" />
                  <div className="ad-card-corner-blob" aria-hidden="true" />
                  <div className="ad-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '18px 20px' }}>
                    
                    {/* Header with Emblem, Title & Tags */}
                    <div className="track-payroll-head">
                      <div className="tph-title-wrap">
                        <div className="tph-emblem">
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="3" />
                            <circle cx="12" cy="12" r="3" />
                            <path d="M6 12h.01M18 12h.01" />
                          </svg>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="tph-title-row">
                            <h2 className="ad-card-title" style={{ fontSize: '1.15rem', margin: 0 }}>Payroll Summary</h2>
                            <span className="ad-stat-pill pill-cyan" style={{ fontSize: '10.5px' }}>{year}</span>
                            <span className="ad-stat-pill pill-emerald" style={{ fontSize: '10.5px' }}>
                              <span className="tph-live-dot" />
                              {data.worker.worker_type === 'contract' ? 'Hourly Contract' : 'Staff'}
                            </span>
                          </div>
                          <div className="ad-card-sub" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                            {data.worker.worker_type === 'contract' || data.worker.department === 'Ext. Manpower'
                              ? `Duty rate AED ${Number(data.worker.duty_rate_hr || payroll.dutyRateHr || 0).toFixed(2)}/hr · OT rate AED ${Number(data.worker.ot_rate || payroll.otRate || 0).toFixed(2)}/hr`
                              : `Basic AED ${Number(payroll.basicSalary || 0).toLocaleString()} + Allowance AED ${Number(payroll.allowance || 0).toLocaleString()}`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* HERO SPOTLIGHT: TOTAL ACCUMULATED NET PAY */}
                    <div className="track-payroll-hero">
                      <div className="tph-hero-glow" aria-hidden="true" />
                      <div className="tph-hero-top">
                        <div className="tph-hero-badge">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                            <polyline points="17 6 23 6 23 12" />
                          </svg>
                          <span>Total Accumulated Net Pay</span>
                        </div>
                        <div className="tph-hero-rate">
                          <span>Avg AED {avgDailyEarn}/day</span>
                        </div>
                      </div>

                      <div className="tph-hero-number-row">
                        <div className="tph-hero-val">
                          <span className="tph-currency">AED</span>
                          <span className="tph-amount">{Number(payroll.net || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="tph-hero-subtag">
                          <span>{payroll.paidDays} active days</span> · <span>{totalPayrollHours} hrs total</span>
                        </div>
                      </div>

                      {/* Visual Segmented Distribution Bar */}
                      <div className="tph-dist-wrapper">
                        <div className="tph-dist-bar">
                          <div
                            className="tph-dist-seg duty"
                            style={{ width: `${dutyPayPct}%` }}
                            title={`Duty Pay: AED ${Number(payroll.totalDailyWage || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} (${dutyPayPct}%)`}
                          />
                          <div
                            className="tph-dist-seg ot"
                            style={{ width: `${otPayPct}%` }}
                            title={`Overtime Pay: AED ${Number(payroll.totalOvertimeWage || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} (${otPayPct}%)`}
                          />
                        </div>
                        <div className="tph-dist-legend">
                          <div className="tph-leg-item">
                            <span className="tph-leg-dot duty" />
                            <span className="tph-leg-name">Duty:</span>
                            <span className="tph-leg-val">AED {Number(payroll.totalDailyWage || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({dutyPayPct}%)</span>
                          </div>
                          <div className="tph-leg-item">
                            <span className="tph-leg-dot ot" />
                            <span className="tph-leg-name">Overtime:</span>
                            <span className="tph-leg-val">AED {Number(payroll.totalOvertimeWage || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({otPayPct}%)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 6 BALANCED THEMED METRIC CARDS */}
                    <div className="track-payroll-grid-v2">
                      {/* 1. Duty Pay */}
                      <div className="tpi-card">
                        <div className="tpi-card-header">
                          <div className="tpi-icon theme-sky">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="6" width="20" height="12" rx="2" />
                              <circle cx="12" cy="12" r="2.5" />
                              <path d="M6 12h.01M18 12h.01" />
                            </svg>
                          </div>
                          <span className="tpi-label">Duty Pay</span>
                        </div>
                        <div className="tpi-num">
                          AED {Number(payroll.totalDailyWage || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="tpi-meta">
                          <span>{payroll.totalDutyHours} hrs logged</span>
                        </div>
                      </div>

                      {/* 2. Overtime Pay */}
                      <div className="tpi-card">
                        <div className="tpi-card-header">
                          <div className="tpi-icon theme-amber">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                          </div>
                          <span className="tpi-label">Overtime Pay</span>
                        </div>
                        <div className="tpi-num">
                          AED {Number(payroll.totalOvertimeWage || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="tpi-meta">
                          <span>{payroll.totalOvertimeHours} OT hrs logged</span>
                        </div>
                      </div>

                      {/* 3. Duty Hours */}
                      <div className="tpi-card">
                        <div className="tpi-card-header">
                          <div className="tpi-icon theme-emerald">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          </div>
                          <span className="tpi-label">Duty Hours</span>
                        </div>
                        <div className="tpi-num">
                          {payroll.totalDutyHours ?? 0} <span className="tpi-unit">hrs</span>
                        </div>
                        <div className="tpi-progress-wrap">
                          <div className="tpi-progress-bar theme-emerald" style={{ width: `${dutyHoursPct}%` }} />
                        </div>
                      </div>

                      {/* 4. Overtime Hours */}
                      <div className="tpi-card">
                        <div className="tpi-card-header">
                          <div className="tpi-icon theme-purple">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 14 14" />
                              <path d="M12 2v2M8 3l1 2M16 3l-1 2" />
                            </svg>
                          </div>
                          <span className="tpi-label">Overtime Hours</span>
                        </div>
                        <div className="tpi-num">
                          {payroll.totalOvertimeHours ?? 0} <span className="tpi-unit">hrs</span>
                        </div>
                        <div className="tpi-progress-wrap">
                          <div className="tpi-progress-bar theme-purple" style={{ width: `${otHoursPct}%` }} />
                        </div>
                      </div>

                      {/* 5. Paid Days */}
                      <div className="tpi-card">
                        <div className="tpi-card-header">
                          <div className="tpi-icon theme-teal">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                              <polyline points="9 16 11 18 15 14" />
                            </svg>
                          </div>
                          <span className="tpi-label">Paid Days</span>
                        </div>
                        <div className="tpi-num">
                          {payroll.paidDays ?? 0} <span className="tpi-unit">/ {payroll.totalDays ?? 0}</span>
                        </div>
                        <div className="tpi-progress-wrap">
                          <div className="tpi-progress-bar theme-teal" style={{ width: `${paidDaysPct}%` }} />
                        </div>
                      </div>

                      {/* 6. Unpaid Days */}
                      <div className="tpi-card">
                        <div className="tpi-card-header">
                          <div className="tpi-icon theme-rose">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                          </div>
                          <span className="tpi-label">Unpaid Days</span>
                        </div>
                        <div className="tpi-num">
                          {payroll.unpaidDays ?? 0} <span className="tpi-unit">days</span>
                        </div>
                        <div className="tpi-meta">
                          <span>{payroll.unpaidDays === 0 ? 'Zero deductions' : 'Leaves & absences'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Strip */}
                    <div className="track-payroll-footer">
                      <div className="tpf-left">
                        <span>⚡ Effective Yield: <strong>AED {effectiveHrYield}/hr</strong></span>
                      </div>
                      <div className="tpf-right">
                        <span>Attendance Ratio: <strong>{paidDaysPct}%</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="track-mid-idcard">
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <TeamLanyardRail
                  items={singleLanyardItem}
                  autoplay={false}
                  hideRail={true}
                  hideCaption={true}
                  cardWidth={240}
                />
              </div>
            </div>
          </div>

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
                      <th rowSpan={2} className="num th-col-id" style={{ width: 44, textAlign: 'center' }}>#</th>
                      <th rowSpan={2} className="corner th-col-period">Period</th>
                      <th colSpan={5} className="grp grp-attendance">Attendance</th>
                      <th colSpan={7} className="grp grp-wages soft">Wages (AED)</th>
                      <th colSpan={7} className="grp grp-leave soft">Leave days by type</th>
                    </tr>
                    <tr>
                      <th className="th-sub th-col-present num">Present</th>
                      <th className="th-sub th-col-late num">Late</th>
                      <th className="th-sub th-col-absent num">Absent</th>
                      <th className="th-sub th-col-nowork num">No Work</th>
                      <th className="th-sub th-col-avg num">Avg %</th>
                      <th className="th-sub th-col-duty-hrs num">Duty hrs</th>
                      <th className="th-sub th-col-ot-hrs num">OT hrs</th>
                      <th className="th-sub th-col-rate num">Duty pay/hr</th>
                      <th className="th-sub th-col-rate num">OT pay/hr</th>
                      <th className="th-sub th-col-duty-pay num">Duty pay</th>
                      <th className="th-sub th-col-ot-pay num">OT pay</th>
                      <th className="th-sub th-col-addl-allow num">Addl. Allow</th>
                      {LEAVE_KEYS.map((k) => (
                        <th key={k} className={`th-sub th-col-leave num th-leave-${k}`}>
                          <span className="ldot" style={{ background: LEAVE_COLORS[k] }} />
                          {LEAVE_SHORT[k]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periodView === 'monthly' ? (
                      monthsWithData.filter(({ i }) => summaryMonth === 'all' || String(i + 1).padStart(2, '0') === summaryMonth).map(({ mn, i, s }, idx) => {
                        const pct = monthPct(s);
                        const counts = { ml: s.ml, annual: s.annual, emergency: s.emergency, work_related: s.workRelated, casual: s.casual, unpaid: s.unpaid, unspecified: s.unspecified };
                        return (
                          <tr key={mn} className="clickrow" onClick={() => setCalMonth(i + 1)}>
                            <td className="num">{idx + 1}</td>
                            <td className="name">{mn}</td>
                            <td className="num">{s.presentDays}</td>
                            <td className="num" style={{ color: (s.lateDays || 0) ? '#F59E0B' : 'inherit' }}>{s.lateDays || '–'}</td>
                            <td className="num warn-num">{s.absentDays}</td>
                            <td className="num" style={{ color: (s.noWorkDays || 0) ? '#64748B' : 'inherit' }}>{s.noWorkDays || '–'}</td>
                            <td className="num">{pct != null && <span className={`pct ${pct < 80 ? 'low' : ''}`}>{pct}%</span>}</td>
                            <td className="num">{s.totalDutyHours || '–'}</td>
                            <td className="num">{renderOtCell(s.totalOvertimeHours, s.sundayOtHours, s.holidayOtHours)}</td>
                            <td className="num">{s.totalDutyHours > 0 ? ((s.totalDailyWage || 0) / s.totalDutyHours).toFixed(2) : '–'}</td>
                            <td className="num">{s.totalOvertimeHours > 0 ? ((s.totalOvertimeWage || 0) / s.totalOvertimeHours).toFixed(2) : '–'}</td>
                            <td className="num">{s.totalDailyWage ? fmtAED(s.totalDailyWage) : '–'}</td>
                            <td className="num">{s.totalOvertimeWage ? fmtAED(s.totalOvertimeWage) : '–'}</td>
                            <td className="num">{data.worker.additional_allowance ? fmtAED(data.worker.additional_allowance) : '–'}</td>
                            {LEAVE_KEYS.map((k) => leaveCell(counts[k], k))}
                          </tr>
                        );
                      })
                    ) : (
                      (periodRows || []).map((row, idx) => {
                        const pct = row.presentDays + row.absentDays > 0
                          ? Math.round((row.presentDays / (row.presentDays + row.absentDays)) * 1000) / 10
                          : null;
                        const counts = { ml: row.ml, annual: row.annual, emergency: row.emergency, work_related: row.workRelated, casual: row.casual, unpaid: row.unpaid, unspecified: row.unspecified };
                        return (
                          <tr key={row.label}>
                            <td className="num">{idx + 1}</td>
                            <td className="name">{row.label}</td>
                            <td className="num">{row.presentDays}</td>
                            <td className="num" style={{ color: row.lateDays ? '#F59E0B' : 'inherit' }}>{row.lateDays || '–'}</td>
                            <td className="num warn-num">{row.absentDays}</td>
                            <td className="num" style={{ color: (row.noWorkDays || 0) ? '#64748B' : 'inherit' }}>{row.noWorkDays || '–'}</td>
                            <td className="num">{pct != null && <span className={`pct ${pct < 80 ? 'low' : ''}`}>{pct}%</span>}</td>
                            <td className="num">{row.totalDutyHours || '–'}</td>
                            <td className="num">{renderOtCell(row.totalOvertimeHours, row.sundayOtHours, row.holidayOtHours)}</td>
                            <td className="num">{row.totalDutyHours > 0 ? ((row.totalDailyWage || 0) / row.totalDutyHours).toFixed(2) : '–'}</td>
                            <td className="num">{row.totalOvertimeHours > 0 ? ((row.totalOvertimeWage || 0) / row.totalOvertimeHours).toFixed(2) : '–'}</td>
                            <td className="num">{row.totalDailyWage ? fmtAED(row.totalDailyWage) : '–'}</td>
                            <td className="num">{row.totalOvertimeWage ? fmtAED(row.totalOvertimeWage) : '–'}</td>
                            <td className="num">{data.worker.additional_allowance ? fmtAED(data.worker.additional_allowance) : '–'}</td>
                            {LEAVE_KEYS.map((k) => leaveCell(counts[k], k))}
                          </tr>
                        );
                      })
                    )}
                    {((periodView === 'monthly' && monthsWithData.length === 0) || (periodView !== 'monthly' && (!periodRows || periodRows.length === 0))) && (
                      <tr>
                        <td colSpan={21} className="muted empty-row">No attendance marked yet for {year}.</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="num" style={{ fontWeight: 800 }}>Σ</td>
                      <td className="name">{activePeriodInfo.badge} Total</td>
                      <td className="num">{activePeriodInfo.totals?.p ?? 0}</td>
                      <td className="num" style={{ color: activePeriodInfo.totals?.late ? '#F59E0B' : 'inherit' }}>{activePeriodInfo.totals?.late || '–'}</td>
                      <td className="num warn-num">{activePeriodInfo.totals?.a ?? 0}</td>
                      <td className="num" style={{ color: (activePeriodInfo.totals?.noWork || 0) ? '#64748B' : 'inherit' }}>{activePeriodInfo.totals?.noWork || '–'}</td>
                      <td className="num">{activePeriodInfo.totals?.pct != null && <span className={`pct ${activePeriodInfo.totals.pct < 80 ? 'low' : ''}`}>{activePeriodInfo.totals.pct}%</span>}</td>
                      <td className="num">{activePeriodInfo.totals?.dutyHrs ? activePeriodInfo.totals.dutyHrs.toFixed(1) : '–'}</td>
                      <td className="num">{renderOtCell(activePeriodInfo.totals?.otHrs, activePeriodInfo.totals?.sundayOtHours, activePeriodInfo.totals?.holidayOtHours)}</td>
                      <td className="num">{activePeriodInfo.totals?.dutyHrs > 0 ? ((activePeriodInfo.totals.dutyWage || 0) / activePeriodInfo.totals.dutyHrs).toFixed(2) : '–'}</td>
                      <td className="num">{activePeriodInfo.totals?.otHrs > 0 ? ((activePeriodInfo.totals.otWage || 0) / activePeriodInfo.totals.otHrs).toFixed(2) : '–'}</td>
                      <td className="num">{fmtAED(activePeriodInfo.totals?.dutyWage)}</td>
                      <td className="num">{fmtAED(activePeriodInfo.totals?.otWage)}</td>
                      <td className="num">{data.worker.additional_allowance ? fmtAED(data.worker.additional_allowance * (activePeriodInfo.summaryRows?.length || 0)) : '–'}</td>
                      {LEAVE_KEYS.map((k) => leaveCell(activePeriodInfo.totals ? activePeriodInfo.totals[k === 'annual' ? 'ann' : k === 'emergency' ? 'emg' : k === 'work_related' ? 'wr' : k === 'casual' ? 'ca' : k === 'unpaid' ? 'un' : k === 'unspecified' ? 'us' : k] : 0, k))}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="tbl-note" style={{ color: '#94A3B8', marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <span>{monthsWithData.length} of 12 months have marked records. Leave colours match the calendar below.</span>
                {data?.worker?.worker_type !== 'contract' && (
                  <span style={{ fontSize: '0.82em', background: 'rgba(2, 132, 199, 0.12)', color: '#38BDF8', padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(56, 189, 248, 0.25)', fontWeight: 600 }}>
                    🏖️ UAE Annual Leave Entitlement: {tot.ann || 0} / 30 days used ({Math.max(0, 30 - (tot.ann || 0))} days remaining)
                  </span>
                )}
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
                <span className="lgd"><span className="swc" style={{ background: '#F97316' }} />Sunday OT</span>
                <span className="lgd"><span className="swc" style={{ background: '#8B5CF6' }} />Holiday OT</span>
                <span className="lgd"><span className="swc" style={{ background: '#64748B' }} />No Work</span>
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

          {/* Daily Attendance & Site Records Card */}
          <div className="ad-card-wrapper" style={{ marginTop: 24 }}>
            <div className="ad-card-border-glow" aria-hidden="true" />
            <div className="ad-card-shine-line" aria-hidden="true" />
            <div className="ad-card-corner-blob" aria-hidden="true" />
            <div className="ad-card">
              <div className="ad-card-head" style={{ flexWrap: 'wrap' }}>
                <div>
                  <h2 className="ad-card-title">Daily Attendance & Site Deployment — {activePeriodInfo.label}</h2>
                  <div className="ad-card-sub">Daily log of client site deployments, clock in/out times, hours, and wages.</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85em', color: '#94A3B8' }}>{activePeriodInfo.dailyRows?.length || 0} days recorded</span>
                </div>
              </div>

              <div className="ad-table-container">
                <table className="tbl daily-records-tbl">
                  <thead>
                    <tr>
                      <th className="num th-col-id" style={{ width: 44, textAlign: 'center' }}>#</th>
                      <th style={{ minWidth: 100 }}>Date</th>
                      <th style={{ width: 60 }}>Day</th>
                      <th style={{ minWidth: 180 }}>Company / Site</th>
                      <th style={{ minWidth: 110 }}>Status</th>
                      <th className="num" style={{ width: 70 }}>In</th>
                      <th className="num" style={{ width: 70 }}>Out</th>
                      <th className="num" style={{ width: 80 }}>Duty Hrs</th>
                      <th className="num" style={{ width: 80 }}>OT Hrs</th>
                      <th className="num" style={{ width: 90 }}>Daily Wage</th>
                      <th style={{ minWidth: 140 }}>Notes / Leave</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activePeriodInfo.dailyRows || []).map((r, idx) => {
                      const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(r.date + 'T00:00:00Z').getUTCDay()];
                      const isSun = dow === 'Sun';
                      const isHol = !!holidayMap[r.date];
                      const totalDayWage = (Number(r.daily_wage) || 0) + (Number(r.overtime_wage) || 0);
                      return (
                        <tr key={r.date}>
                          <td className="num">{idx + 1}</td>
                          <td><strong>{r.date}</strong></td>
                          <td style={{ color: isSun ? '#F59E0B' : isHol ? '#A855F7' : 'inherit', fontWeight: isSun || isHol ? 600 : 400 }}>{dow}</td>
                          <td>
                            {r.site ? (
                              <span className="site-pill">{r.site}</span>
                            ) : (
                              <span className="exp-dash">—</span>
                            )}
                          </td>
                          <td>
                            <span className={`sv-mark ${r.status}${r.is_late ? ' late' : ''}${r.ot_type ? ` ot-${r.ot_type}` : ''}`} style={{ fontSize: '0.78em', padding: '3px 8px' }}>
                              {r.status === 'present'
                                ? (r.ot_type === 'sunday'
                                    ? '☀️ OT (Sun)'
                                    : r.ot_type === 'holiday'
                                      ? '🎉 OT (Hol)'
                                      : (r.is_late ? '⏰ Late' : '✓ Present'))
                                : (r.status === 'no_work'
                                  ? '⚪ No Work'
                                  : `✕ ${LEAVE_LABELS[r.leave_type] || 'Absent'}`)}
                            </span>
                          </td>
                          <td className="num">{r.time_in || '—'}</td>
                          <td className="num">{r.time_out || '—'}</td>
                          <td className="num">{r.duty_hours ? `${r.duty_hours}h` : '–'}</td>
                          <td className="num" style={{ color: r.overtime_hours ? '#38BDF8' : 'inherit' }}>{r.overtime_hours ? `+${r.overtime_hours}h` : '–'}</td>
                          <td className="num">{totalDayWage > 0 ? fmtAED(totalDayWage) : '–'}</td>
                          <td style={{ fontSize: '0.86em', color: '#94A3B8' }}>{r.notes || (r.leave_type ? LEAVE_LABELS[r.leave_type] : '—')}</td>
                        </tr>
                      );
                    })}
                    {(!activePeriodInfo.dailyRows || activePeriodInfo.dailyRows.length === 0) && (
                      <tr>
                        <td colSpan={11} className="muted empty-row" style={{ textAlign: 'center', padding: 24 }}>
                          No daily records found for {activePeriodInfo.label}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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

    if (r.status === 'no_work') {
      const nwTime = r.recorded_at ? ` · ${new Date(r.recorded_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : '';
      const tipText = `${iso} — No Work${r.notes ? ` · ${r.notes}` : ''}${nwTime}${holLabel ? ` · ${holLabel}` : ''}`;
      cells.push(
        <Tip key={iso} text={tipText}>
          <div
            className="cell no-work"
            style={{ background: 'rgba(100, 116, 139, 0.18)', borderColor: 'rgba(100, 116, 139, 0.55)' }}
          >
            <span className="mark" style={{ background: '#64748B', color: '#FFFFFF', boxShadow: '0 0 10px rgba(100, 116, 139, 0.6)', fontWeight: 700 }}>{d}</span>
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

    if (r.ot_type === 'sunday') {
      const timeStr = r.recorded_at ? ` · ${new Date(r.recorded_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : '';
      const otHrsStr = r.overtime_hours ? ` · ${r.overtime_hours}h OT` : '';
      const otWageStr = r.overtime_wage ? ` · AED ${r.overtime_wage}` : '';
      const tipText = `${iso} — Sunday Overtime${otHrsStr}${otWageStr}${timeStr}`;
      cells.push(
        <Tip key={iso} text={tipText}>
          <div
            className="cell ot-sun"
            style={{ background: 'rgba(249, 115, 22, 0.18)', borderColor: 'rgba(249, 115, 22, 0.55)' }}
          >
            <span className="mark" style={{ background: 'linear-gradient(135deg, #EA580C, #F97316)', color: '#FFFFFF', boxShadow: '0 0 10px rgba(249, 115, 22, 0.6)', fontWeight: 700 }}>{d}</span>
          </div>
        </Tip>,
      );
      continue;
    }

    if (r.ot_type === 'holiday') {
      const timeStr = r.recorded_at ? ` · ${new Date(r.recorded_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}` : '';
      const otHrsStr = r.overtime_hours ? ` · ${r.overtime_hours}h OT` : '';
      const otWageStr = r.overtime_wage ? ` · AED ${r.overtime_wage}` : '';
      const tipText = `${iso} — Holiday Overtime${holLabel ? ` (${holLabel})` : ''}${otHrsStr}${otWageStr}${timeStr}`;
      cells.push(
        <Tip key={iso} text={tipText}>
          <div
            className="cell ot-hol"
            style={{ background: 'rgba(139, 92, 246, 0.18)', borderColor: 'rgba(139, 92, 246, 0.55)' }}
          >
            <span className="mark" style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)', color: '#FFFFFF', boxShadow: '0 0 10px rgba(139, 92, 246, 0.6)', fontWeight: 700 }}>{d}</span>
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
