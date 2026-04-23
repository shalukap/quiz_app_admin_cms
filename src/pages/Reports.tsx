import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Download, FileText, Search, Loader2, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sinhalaFont } from '../assets/sinhala-font';

interface SubjectReport {
  id: string;
  name: string;
  grade: number;
  medium: string;
  questionCount: number;
}

export const Reports: React.FC = () => {
  const [reports, setReports] = useState<SubjectReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('All');
  const [exporting, setExporting] = useState(false);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const subjectsSnapshot = await getDocs(query(collection(db, 'subjects'), orderBy('grade', 'asc')));
      const subjectsData = subjectsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];

      const reportData = await Promise.all(
        subjectsData.map(async (subject) => {
          const qCount = query(
            collection(db, 'questions'),
            where('subjectId', '==', subject.id)
          );
          const countSnapshot = await getCountFromServer(qCount);
          return {
            id: subject.id,
            name: subject.name,
            grade: subject.grade,
            medium: subject.medium || 'English',
            questionCount: countSnapshot.data().count
          };
        })
      );

      setReports(reportData);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const filteredReports = reports.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         `Grade ${r.grade}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = selectedGrade === 'All' || r.grade.toString() === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  const mediums = Array.from(new Set(filteredReports.map(r => r.medium))).sort();

  const downloadPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF();

      // Register Unified Font (Supports both English and Sinhala)
      doc.addFileToVFS('AppFont.ttf', sinhalaFont);
      doc.addFont('AppFont.ttf', 'AppFont', 'normal');
      doc.setFont('AppFont');
      
      // Add Title
      doc.setFontSize(20);
      doc.setTextColor(40);
      const title = selectedGrade === 'All' 
        ? 'Quiz System - All Grades Summary Report' 
        : `Quiz System - Grade ${selectedGrade} Summary Report`;
      doc.text(title, 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
      
      let currentY = 40;

      mediums.forEach((medium, index) => {
        const mediumData = filteredReports.filter(r => r.medium === medium);
        if (mediumData.length === 0) return;

        // Add Medium Section Header
        doc.setFontSize(14);
        doc.setTextColor(37, 99, 235); // Blue-600
        doc.text(`${medium} Medium`, 14, currentY + 10);
        
        const tableData = mediumData.map(r => [
          r.name,
          `Grade ${r.grade}`,
          r.questionCount.toString()
        ]);

        autoTable(doc, {
          head: [['Subject', 'Grade', 'No. of Questions']],
          body: tableData,
          startY: currentY + 15,
          styles: { font: 'AppFont', fontSize: 10, cellPadding: 3 },
          headStyles: { font: 'AppFont', fillColor: [37, 99, 235], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          margin: { top: 40 },
        });

        // @ts-ignore
        currentY = doc.lastAutoTable.finalY + 10;

        // Check for new page
        if (currentY > 250 && index < mediums.length - 1) {
          doc.addPage();
          currentY = 20;
        }
      });

      const fileName = selectedGrade === 'All' ? 'All_Grades' : `Grade_${selectedGrade}`;
      doc.save(`Quiz_Report_${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report.');
    } finally {
      setExporting(false);
    }
  };

  const totalQuestions = filteredReports.reduce((acc, curr) => acc + curr.questionCount, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">System Reports</h1>
              <p className="text-sm text-slate-400">Inventory grouped by medium and grade</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5">
              <Filter className="text-slate-500" size={16} />
              <select 
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="bg-transparent border-none text-white text-sm outline-none cursor-pointer pr-2"
              >
                <option value="All" className="bg-slate-800 text-white">All Grades</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                  <option key={g} value={g} className="bg-slate-800 text-white">Grade {g}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Search subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-48 md:w-64 transition-all"
              />
            </div>
            
            <button
              onClick={downloadPDF}
              disabled={loading || filteredReports.length === 0 || exporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-900/20"
            >
              {exporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 text-slate-700 group-hover:text-blue-500/20 transition-colors">
              <FileText size={48} />
            </div>
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-semibold">Subjects</p>
            <p className="text-3xl font-bold text-white">{filteredReports.length}</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 text-slate-700 group-hover:text-emerald-500/20 transition-colors">
              <Activity size={48} />
            </div>
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-semibold">Total Questions</p>
            <p className="text-3xl font-bold text-emerald-400">{totalQuestions}</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 text-slate-700 group-hover:text-blue-500/20 transition-colors">
              <Download size={48} />
            </div>
            <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider font-semibold">Selected Scope</p>
            <p className="text-xl font-bold text-blue-400">{selectedGrade === 'All' ? 'All Grades' : `Grade ${selectedGrade}`}</p>
          </div>
        </div>

        {/* Grouped Table Content */}
        <div className="space-y-8">
          {loading ? (
            <div className="bg-slate-800 rounded-2xl border border-slate-700/50 p-20 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-blue-500" size={40} />
              <p className="text-slate-400 animate-pulse font-medium">Analyzing question databank...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-slate-800 rounded-2xl border border-slate-700/50 p-20 text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
                <FileText className="text-slate-700" size={32} />
              </div>
              <p className="text-slate-400">No report data matches your selection.</p>
            </div>
          ) : (
            mediums.map(medium => {
              const mediumData = filteredReports.filter(r => r.medium === medium);
              if (mediumData.length === 0) return null;

              return (
                <div key={medium} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-800"></div>
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-4 py-1 bg-slate-800 rounded-full border border-slate-700">
                      {medium} Medium
                    </h2>
                    <div className="h-px flex-1 bg-slate-800"></div>
                  </div>

                  <div className="bg-slate-800 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-slate-900/50 border-b border-slate-700">
                          <tr>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Subject Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Grade</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Question Count</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {mediumData.map((report) => (
                            <tr key={report.id} className="hover:bg-slate-700/30 transition-all group">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">{report.name}</div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="bg-slate-900/50 text-slate-300 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-slate-700 shadow-inner">
                                  Grade {report.grade}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end">
                                  <span className={`font-mono font-bold text-lg ${report.questionCount > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                                    {report.questionCount}
                                  </span>
                                  <div className="h-1 w-16 bg-slate-700 rounded-full mt-1 overflow-hidden">
                                    <div 
                                      className="h-full bg-emerald-500/50" 
                                      style={{ width: `${Math.min((report.questionCount / 100) * 100, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

// Simple Activity Icon fallback if not imported
const Activity = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
  </svg>
);
