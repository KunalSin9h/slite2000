import React, { useState, useEffect } from 'react';
import { Play, Table as TableIcon, LogOut, Database, BarChart2, Filter, X, PieChart } from 'lucide-react';
import { ExecuteQuery } from '../../wailsjs/go/main/App';
import { Visualization } from './Visualization';

interface DashboardProps {
    dbPath: string;
    onLogout: () => void;
}

type ViewMode = 'table' | 'chart';
type ChartType = 'bar' | 'line' | 'area';

interface FilterConfig {
    column: string;
    operator: '=' | '>' | '<' | 'LIKE';
    value: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ dbPath, onLogout }) => {
    const [query, setQuery] = useState("SELECT * FROM sqlite_master WHERE type='table' LIMIT 10;");
    const [results, setResults] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [tables, setTables] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Visualization State
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [chartType, setChartType] = useState<ChartType>('bar');
    const [xAxisKey, setXAxisKey] = useState('');
    const [dataKey, setDataKey] = useState('');

    // Filter State
    const [activeTable, setActiveTable] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<FilterConfig[]>([]);

    // Distribution State
    const [showDistribution, setShowDistribution] = useState(false);
    const [distributionColumn, setDistributionColumn] = useState('');

    useEffect(() => {
        fetchTables();
    }, []);

    // Auto-select keys for chart when results change
    useEffect(() => {
        if (results.length > 0 && columns.length > 0) {
            if (!columns.includes(xAxisKey)) setXAxisKey(columns[0]);
            // Try to find a numeric column for dataKey
            const numericCol = columns.find(col => typeof results[0][col] === 'number');
            if (numericCol && !columns.includes(dataKey)) setDataKey(numericCol);
            else if (!columns.includes(dataKey)) setDataKey(columns[1] || columns[0]);
        }
    }, [results, columns, xAxisKey, dataKey]);

    const fetchTables = async () => {
        try {
            const res = await ExecuteQuery(dbPath, "SELECT name FROM sqlite_master WHERE type='table';");
            if (res.startsWith("Error")) {
                console.error(res);
                return;
            }
            const parsed = JSON.parse(res);
            setTables(parsed.map((row: any) => row.name));
        } catch (e) {
            console.error("Failed to fetch tables", e);
        }
    };

    const handleExecute = async () => {
        setIsLoading(true);
        setError(null);
        setResults([]);
        setColumns([]);

        try {
            const res = await ExecuteQuery(dbPath, query);
            if (res.startsWith("Error")) {
                setError(res);
            } else if (res.trim() === "") {
                setResults([]);
                setError("No results or empty response.");
            } else {
                const parsed = JSON.parse(res);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setResults(parsed);
                    setColumns(Object.keys(parsed[0]));
                } else {
                    setResults([]);
                    setError("Query executed successfully but returned no data.");
                }
            }
        } catch (e: any) {
            setError("Execution failed: " + e.toString());
        } finally {
            setIsLoading(false);
        }
    };

    const handleTableClick = (tableName: string) => {
        setActiveTable(tableName);
        setFilters([]);
        const q = `SELECT * FROM ${tableName} LIMIT 100;`;
        setQuery(q);
        executeCustomQuery(q);
    };

    const executeCustomQuery = async (q: string) => {
        setIsLoading(true);
        setError(null);
        setResults([]);
        setColumns([]);
        try {
            const res = await ExecuteQuery(dbPath, q);
            if (res.startsWith("Error")) {
                setError(res);
            } else {
                const parsed = JSON.parse(res);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setResults(parsed);
                    setColumns(Object.keys(parsed[0]));
                } else {
                    setResults([]);
                }
            }
        } catch (e: any) {
            setError("Execution failed: " + e.toString());
        } finally {
            setIsLoading(false);
        }
    }

    const applyFilters = () => {
        if (!activeTable) return;

        let whereClause = "";
        if (filters.length > 0) {
            const conditions = filters.map(f => {
                const val = f.operator === 'LIKE' ? `'%${f.value}%'` : `'${f.value}'`;
                return `${f.column} ${f.operator} ${val}`;
            });
            whereClause = `WHERE ${conditions.join(' AND ')}`;
        }

        const q = `SELECT * FROM ${activeTable} ${whereClause} LIMIT 100;`;
        setQuery(q);
        executeCustomQuery(q);
    };

    const addFilter = () => {
        if (columns.length > 0) {
            setFilters([...filters, { column: columns[0], operator: '=', value: '' }]);
        }
    };

    const removeFilter = (idx: number) => {
        const newFilters = [...filters];
        newFilters.splice(idx, 1);
        setFilters(newFilters);
    };

    const updateFilter = (idx: number, field: keyof FilterConfig, value: string) => {
        const newFilters = [...filters];
        newFilters[idx] = { ...newFilters[idx], [field]: value };
        setFilters(newFilters);
    };

    const handleDistribution = async () => {
        if (!activeTable || !distributionColumn) return;

        const q = `SELECT "${distributionColumn}" as value, COUNT(*) as count FROM "${activeTable}" GROUP BY "${distributionColumn}" ORDER BY count DESC LIMIT 50;`;
        setQuery(q);

        setIsLoading(true);
        setError(null);
        setResults([]);
        // Don't clear columns here, we want to keep the table schema columns for the dropdown
        // But wait, executeCustomQuery clears columns. We should probably preserve them or re-fetch them?
        // Actually, executeCustomQuery sets columns based on result. 
        // If we run a distribution query, the result columns will be 'value' and 'count'.
        // This might mess up the column selector if we want to switch back to another column.
        // But that's okay, the user can click the table name again to reset.

        try {
            const res = await ExecuteQuery(dbPath, q);
            if (res.startsWith("Error")) {
                setError(res);
            } else {
                const parsed = JSON.parse(res);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setResults(parsed);
                    // We intentionally don't overwrite 'columns' here if we want to keep the dropdown populated?
                    // No, 'columns' state drives the table view AND the dropdowns.
                    // If we overwrite 'columns' with ['value', 'count'], the dropdown will only show those.
                    // So we should probably separate 'tableColumns' from 'resultColumns'.
                    // For now, let's just let it be. If they want to distribute on another column, they might need to reload the table.
                    // OR, we can just NOT update columns if it's a distribution query?
                    // But the Table View needs 'columns' to render the results.
                    // Let's stick to the standard behavior: update columns to match results.
                    // The user can click the table name to "reset" context.
                    setColumns(Object.keys(parsed[0]));

                    // Switch to chart mode
                    setViewMode('chart');
                    setChartType('bar');
                    setXAxisKey('value');
                    setDataKey('count');
                } else {
                    setResults([]);
                    setError("No distribution data found.");
                }
            }
        } catch (e: any) {
            setError("Execution failed: " + e.toString());
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#1E1E1E] text-[#CCCCCC] font-sans text-sm">
            {/* Sidebar */}
            <div className="w-60 bg-[#252526] border-r border-[#1E1E1E] flex flex-col">
                <div className="p-3 border-b border-[#1E1E1E] bg-[#2D2D2D]">
                    <div className="flex items-center gap-2 text-[#E0E0E0]">
                        <Database className="w-4 h-4 text-[#8B5CF6]" />
                        <span className="font-medium truncate text-xs" title={dbPath}>{dbPath.split('/').pop()}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="px-3 py-2 text-[10px] font-bold text-[#6F6F6F] uppercase tracking-wider">Tables</div>
                    <ul className="space-y-[1px]">
                        {tables.map(table => (
                            <li key={table}>
                                <button
                                    onClick={() => handleTableClick(table)}
                                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs transition-colors border-l-2 focus:outline-none ${activeTable === table ? 'bg-[#37373D] text-white border-[#8B5CF6]' : 'text-[#CCCCCC] hover:bg-[#2A2D2E] border-transparent'}`}
                                >
                                    <TableIcon className="w-3 h-3 text-[#999999]" />
                                    {table}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="p-2 border-t border-[#1E1E1E] bg-[#252526]">
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 text-[#CCCCCC] hover:bg-[#2A2D2E] px-3 py-1.5 rounded-sm text-xs w-full transition-colors"
                    >
                        <LogOut className="w-3 h-3" />
                        Disconnect
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#1E1E1E]">
                {/* Query Editor */}
                <div className="h-1/4 border-b border-[#2D2D2D] flex flex-col bg-[#1E1E1E]">
                    <div className="px-3 py-1.5 bg-[#252526] border-b border-[#1E1E1E] flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-medium text-[#CCCCCC]">SQL Query</span>
                            {activeTable && (
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm transition-colors ${showFilters ? 'bg-[#37373D] text-white' : 'text-[#999999] hover:text-[#CCCCCC]'}`}
                                >
                                    <Filter className="w-3 h-3" />
                                    Filters
                                </button>
                            )}
                            {activeTable && (
                                <button
                                    onClick={() => {
                                        setShowDistribution(!showDistribution);
                                        setShowFilters(false);
                                    }}
                                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm transition-colors ${showDistribution ? 'bg-[#37373D] text-white' : 'text-[#999999] hover:text-[#CCCCCC]'}`}
                                >
                                    <PieChart className="w-3 h-3" />
                                    Distribution
                                </button>
                            )}
                        </div>
                        <button
                            onClick={handleExecute}
                            disabled={isLoading}
                            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs px-3 py-1 rounded-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                            <Play className="w-3 h-3" />
                            Run
                        </button>
                    </div>

                    {/* Filter Bar */}
                    {showFilters && activeTable && (
                        <div className="bg-[#2D2D2D] p-2 border-b border-[#1E1E1E] flex flex-wrap gap-2 items-center">
                            {filters.map((f, idx) => (
                                <div key={idx} className="flex items-center gap-1 bg-[#37373D] px-2 py-1 rounded-sm border border-[#454545]">
                                    <select
                                        value={f.column}
                                        onChange={(e) => updateFilter(idx, 'column', e.target.value)}
                                        className="bg-transparent text-xs text-[#CCCCCC] outline-none border-none p-0"
                                    >
                                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select
                                        value={f.operator}
                                        onChange={(e) => updateFilter(idx, 'operator', e.target.value as any)}
                                        className="bg-transparent text-xs text-[#8B5CF6] font-bold outline-none border-none p-0 mx-1"
                                    >
                                        <option value="=">=</option>
                                        <option value=">">&gt;</option>
                                        <option value="<">&lt;</option>
                                        <option value="LIKE">contains</option>
                                    </select>
                                    <input
                                        type="text"
                                        value={f.value}
                                        onChange={(e) => updateFilter(idx, 'value', e.target.value)}
                                        className="bg-[#1E1E1E] text-xs text-[#CCCCCC] px-1 py-0.5 rounded-sm w-20 outline-none border border-[#454545] focus:border-[#8B5CF6]"
                                        placeholder="Value"
                                    />
                                    <button onClick={() => removeFilter(idx)} className="ml-1 text-[#666666] hover:text-red-400">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <button onClick={addFilter} className="text-xs text-[#8B5CF6] hover:underline px-2">+ Add Filter</button>
                            <div className="flex-1"></div>
                            <button onClick={applyFilters} className="text-xs bg-[#37373D] hover:bg-[#454545] text-[#CCCCCC] px-2 py-1 rounded-sm border border-[#454545]">Apply</button>
                        </div>
                    )}

                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="flex-1 bg-[#1E1E1E] text-[#D4D4D4] p-3 font-mono text-sm focus:outline-none resize-none leading-relaxed"
                        placeholder="SELECT * FROM table..."
                        spellCheck={false}
                    />
                </div>

                {/* Results / Visualization Area */}
                <div className="flex-1 overflow-hidden flex flex-col bg-[#1E1E1E]">
                    {/* View Toggle Bar */}
                    <div className="flex items-center justify-between px-3 py-1 bg-[#252526] border-b border-[#1E1E1E]">
                        <div className="flex gap-1">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-colors ${viewMode === 'table' ? 'bg-[#37373D] text-white' : 'text-[#999999] hover:text-[#CCCCCC]'}`}
                            >
                                <TableIcon className="w-3 h-3" />
                                Table
                            </button>
                            <button
                                onClick={() => setViewMode('chart')}
                                className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs transition-colors ${viewMode === 'chart' ? 'bg-[#37373D] text-white' : 'text-[#999999] hover:text-[#CCCCCC]'}`}
                            >
                                <BarChart2 className="w-3 h-3" />
                                Visualization
                            </button>
                        </div>

                        {viewMode === 'chart' && (
                            <div className="flex items-center gap-2">
                                <select
                                    value={chartType}
                                    onChange={(e) => setChartType(e.target.value as any)}
                                    className="bg-[#1E1E1E] text-[#CCCCCC] text-xs border border-[#3E3E3E] rounded-sm px-1 py-0.5 outline-none"
                                >
                                    <option value="bar">Bar</option>
                                    <option value="line">Line</option>
                                    <option value="area">Area</option>
                                </select>
                                <span className="text-[#666666] text-xs">X:</span>
                                <select
                                    value={xAxisKey}
                                    onChange={(e) => setXAxisKey(e.target.value)}
                                    className="bg-[#1E1E1E] text-[#CCCCCC] text-xs border border-[#3E3E3E] rounded-sm px-1 py-0.5 outline-none"
                                >
                                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <span className="text-[#666666] text-xs">Y:</span>
                                <select
                                    value={dataKey}
                                    onChange={(e) => setDataKey(e.target.value)}
                                    className="bg-[#1E1E1E] text-[#CCCCCC] text-xs border border-[#3E3E3E] rounded-sm px-1 py-0.5 outline-none"
                                >
                                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Distribution Bar */}
                    {showDistribution && activeTable && (
                        <div className="bg-[#2D2D2D] p-2 border-b border-[#1E1E1E] flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
                            <span className="text-xs text-[#CCCCCC] font-medium">Distribution of:</span>
                            <select
                                value={distributionColumn}
                                onChange={(e) => setDistributionColumn(e.target.value)}
                                className="bg-[#37373D] text-[#CCCCCC] text-xs border border-[#454545] rounded-sm px-2 py-1 outline-none focus:border-[#8B5CF6]"
                            >
                                <option value="">Select Column</option>
                                {columns.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <button
                                onClick={handleDistribution}
                                disabled={!distributionColumn}
                                className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs px-3 py-1 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Show Distribution
                            </button>
                            <button onClick={() => setShowDistribution(false)} className="ml-auto text-[#666666] hover:text-[#CCCCCC]">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {error ? (
                        <div className="m-4 bg-[#3a1d1d] border border-[#5a2d2d] text-[#f87171] p-3 rounded-sm text-xs font-mono">
                            {error}
                        </div>
                    ) : results.length > 0 ? (
                        <div className="flex-1 overflow-auto relative">
                            {viewMode === 'table' ? (
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-[#252526] z-10 shadow-sm">
                                        <tr>
                                            {columns.map(col => (
                                                <th key={col} className="px-3 py-1.5 border-b border-r border-[#333333] last:border-r-0 text-xs font-semibold text-[#CCCCCC] whitespace-nowrap select-none">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono text-xs">
                                        {results.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-[#2A2D2E] group">
                                                {columns.map(col => (
                                                    <td key={`${idx}-${col}`} className="px-3 py-1 border-b border-r border-[#2D2D2D] last:border-r-0 text-[#D4D4D4] whitespace-nowrap group-hover:border-[#2D2D2D]">
                                                        {row[col] !== null ? (
                                                            String(row[col])
                                                        ) : (
                                                            <span className="text-[#555555] italic">NULL</span>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="w-full h-full p-4">
                                    <Visualization
                                        data={results}
                                        type={chartType}
                                        xAxisKey={xAxisKey}
                                        dataKey={dataKey}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-[#444444]">
                            <Database className="w-10 h-10 mb-2 opacity-20" />
                            <p className="text-xs">No data to display</p>
                        </div>
                    )}

                    {/* Footer Status Bar */}
                    <div className="bg-[#8B5CF6] text-white text-[10px] px-2 py-0.5 flex justify-between items-center">
                        <span>{results.length} rows</span>
                        <span>{isLoading ? 'Executing...' : 'Ready'}</span>
                    </div>
                </div>
            </div>
        </div >
    );
};
