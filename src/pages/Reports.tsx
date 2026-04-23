import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { ChevronLeft, Download, FileText, Search, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const downloadPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      
      // Add Title
      doc.setFontSize(20);
      doc.setTextColor(40);
      doc.text('Quiz System - Questions Summary Report', 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
      
      // Prepare Table Data
      const tableData = filteredReports.map(r => [
        r.name,
        `Grade ${r.grade}`,
        r.medium,
        r.questionCount.toString()
      ]);

      autoTable(doc, {
        head: [['Subject', 'Grade', 'Medium', 'No. of Questions']],
        body: tableData,
        startY: 40,
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      });

      doc.save(`Quiz_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report.');
    } finally {
      setExporting(false);
    }
  };

  const filteredReports = reports.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `Grade ${r.grade}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalQuestions = reports.reduce((acc, curr) => acc + curr.questionCount, 0);

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
              <p className="text-sm text-slate-400">Inventory of subjects and question counts</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Search subject or grade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-all"
              />
            </div>
            <button
              onClick={downloadPDF}
              disabled={loading || reports.length === 0 || exporting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-900/20"
            >
              {exporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50">
            <p className="text-slate-400 text-sm mb-1">Total Subjects</p>
            <p className="text-3xl font-bold text-white">{reports.length}</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50">
            <p className="text-slate-400 text-sm mb-1">Total Questions</p>
            <p className="text-3xl font-bold text-emerald-400">{totalQuestions}</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700/50">
            <p className="text-slate-400 text-sm mb-1">Last Updated</p>
            <p className="text-xl font-bold text-blue-400">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Table Content */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700/50 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="animate-spin text-blue-500" size={40} />
              <p className="text-slate-400 animate-pulse">Analyzing question databank...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-20 text-center">
              <FileText className="mx-auto text-slate-700 mb-4" size={48} />
              <p className="text-slate-400">No report data matches your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900/50 border-b border-slate-700">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-300">Subject Name</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-300">Grade</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-300">Medium</th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-300 text-right">Question Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-700/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white group-hover:text-blue-400 transition-colors">{report.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-full border border-slate-600">
                          Grade {report.grade}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{report.medium}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-mono font-bold ${report.questionCount > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {report.questionCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
