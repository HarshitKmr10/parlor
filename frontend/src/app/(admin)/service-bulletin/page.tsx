"use client";
import React, { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, Clock, Filter, Download, Mail, Send, Sparkles, FileText, TrendingUp, Calendar, ChevronDown, ChevronUp, Wrench, MapPin } from 'lucide-react';

const SBInvestigationDashboard = () => {
  const [selectedSB, setSelectedSB] = useState(null);
  const [expandedEngine, setExpandedEngine] = useState(null);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);

  // Service Bulletins - GEnx and LEAP engines from database
  const serviceBulletins = [
    {
      id: 1,
      sbNumber: 'GEnx-1B S/B 79-0234',
      revision: '02',
      title: 'FMU Bypass Valve Plug Clearance Inspection',
      oem: 'GE Aviation',
      engineModel: 'GEnx-1B',
      category: 'MANDATORY',
      issueDate: '2025-08-15',
      complianceTime: 'Within 500 FC',
      affectedCount: 8,
      totalFleet: 15,
      status: 'ACTIVE',
      priority: 'HIGH',
      supersedes: 'GEnx-1B S/B 79-0234 Rev 01',
      estimatedManhours: 12,
      partsRequired: 'Yes',
      toolingRequired: 'Special tooling required',
      applicabilityScope: 'All GEnx-1B engines'
    },
    {
      id: 2,
      sbNumber: 'LEAP-1A S/B 72-1567',
      revision: '01',
      title: 'Non-Synchronous Vibration Monitoring Recommendations',
      oem: 'CFM International',
      engineModel: 'LEAP-1A',
      category: 'RECOMMENDED',
      issueDate: '2025-09-01',
      complianceTime: 'Next shop visit',
      affectedCount: 12,
      totalFleet: 32,
      status: 'ACTIVE',
      priority: 'MEDIUM',
      supersedes: null,
      estimatedManhours: 8,
      partsRequired: 'No',
      toolingRequired: 'Standard tooling',
      applicabilityScope: 'All LEAP-1A engines'
    },
    {
      id: 3,
      sbNumber: 'LEAP-1A S/B 73-2891',
      revision: '00',
      title: 'Bearing Spring Finger Housing Wear',
      oem: 'CFM International',
      engineModel: 'LEAP-1A',
      category: 'ALERT',
      issueDate: '2025-07-20',
      complianceTime: 'Within 200 FH',
      affectedCount: 15,
      totalFleet: 32,
      status: 'ACTIVE',
      priority: 'CRITICAL',
      supersedes: null,
      estimatedManhours: 16,
      partsRequired: 'Yes',
      toolingRequired: 'Special inspection tools',
      applicabilityScope: 'All LEAP-1A engines'
    },
    {
      id: 4,
      sbNumber: 'GEnx-1B S/B 72-4567',
      revision: '01',
      title: 'High Pressure Turbine Blade Inspection',
      oem: 'GE Aviation',
      engineModel: 'GEnx-1B',
      category: 'MANDATORY',
      issueDate: '2025-06-10',
      complianceTime: 'Within 1000 FH',
      affectedCount: 10,
      totalFleet: 15,
      status: 'ACTIVE',
      priority: 'HIGH',
      supersedes: 'GEnx-1B S/B 72-4567 Rev 00',
      estimatedManhours: 10,
      partsRequired: 'No',
      toolingRequired: 'Borescope equipment',
      applicabilityScope: 'All GEnx-1B70 and above variants'
    },
    {
      id: 5,
      sbNumber: 'LEAP-1B S/B 78-3421',
      revision: '02',
      title: 'Fan Blade Leading Edge Inspection',
      oem: 'CFM International',
      engineModel: 'LEAP-1B',
      category: 'MANDATORY',
      issueDate: '2025-08-25',
      complianceTime: 'Within 600 FC',
      affectedCount: 18,
      totalFleet: 28,
      status: 'ACTIVE',
      priority: 'HIGH',
      supersedes: 'LEAP-1B S/B 78-3421 Rev 01',
      estimatedManhours: 14,
      partsRequired: 'Yes',
      toolingRequired: 'Eddy current inspection kit',
      applicabilityScope: 'All LEAP-1B engines'
    },
    {
      id: 6,
      sbNumber: 'GEnx-1B S/B 79-5678',
      revision: '00',
      title: 'Combustion Chamber Liner Inspection',
      oem: 'GE Aviation',
      engineModel: 'GEnx-1B',
      category: 'RECOMMENDED',
      issueDate: '2025-09-15',
      complianceTime: 'Next major inspection',
      affectedCount: 6,
      totalFleet: 15,
      status: 'ACTIVE',
      priority: 'MEDIUM',
      supersedes: null,
      estimatedManhours: 18,
      partsRequired: 'No',
      toolingRequired: 'Borescope',
      applicabilityScope: 'All GEnx-1B engines'
    },
    {
      id: 7,
      sbNumber: 'LEAP-1A S/B 72-6789',
      revision: '01',
      title: 'Low Pressure Turbine Seal Replacement',
      oem: 'CFM International',
      engineModel: 'LEAP-1A',
      category: 'ALERT',
      issueDate: '2025-09-20',
      complianceTime: 'Within 300 FH',
      affectedCount: 8,
      totalFleet: 32,
      status: 'ACTIVE',
      priority: 'HIGH',
      supersedes: 'LEAP-1A S/B 72-6789 Rev 00',
      estimatedManhours: 20,
      partsRequired: 'Yes',
      toolingRequired: 'Standard tooling',
      applicabilityScope: 'LEAP-1A26 and above models'
    },
    {
      id: 8,
      sbNumber: 'LEAP-1B S/B 79-8901',
      revision: '00',
      title: 'Engine Oil Filter Element Replacement',
      oem: 'CFM International',
      engineModel: 'LEAP-1B',
      category: 'OPTIONAL',
      issueDate: '2025-08-30',
      complianceTime: 'At operator discretion',
      affectedCount: 5,
      totalFleet: 28,
      status: 'ACTIVE',
      priority: 'LOW',
      supersedes: null,
      estimatedManhours: 4,
      partsRequired: 'Yes',
      toolingRequired: 'Standard tooling',
      applicabilityScope: 'All LEAP-1B engines'
    },
    {
      id: 9,
      sbNumber: 'GEnx-1B S/B 73-1234',
      revision: '01',
      title: 'Fan Blade Vibration Damper Inspection',
      oem: 'GE Aviation',
      engineModel: 'GEnx-1B',
      category: 'ALERT',
      issueDate: '2025-09-25',
      complianceTime: 'Within 150 FC',
      affectedCount: 4,
      totalFleet: 15,
      status: 'ACTIVE',
      priority: 'CRITICAL',
      supersedes: 'GEnx-1B S/B 73-1234 Rev 00',
      estimatedManhours: 8,
      partsRequired: 'No',
      toolingRequired: 'Vibration analysis equipment',
      applicabilityScope: 'GEnx-1B70/P1 and GEnx-1B70/P2 only'
    },
    {
      id: 10,
      sbNumber: 'LEAP-1A S/B 72-4561',
      revision: '00',
      title: 'Fuel Nozzle Flow Test Procedure',
      oem: 'CFM International',
      engineModel: 'LEAP-1A',
      category: 'RECOMMENDED',
      issueDate: '2025-07-15',
      complianceTime: 'Next shop visit',
      affectedCount: 10,
      totalFleet: 32,
      status: 'ACTIVE',
      priority: 'MEDIUM',
      supersedes: null,
      estimatedManhours: 6,
      partsRequired: 'No',
      toolingRequired: 'Flow test bench',
      applicabilityScope: 'All LEAP-1A engines'
    }
  ];

  // Affected engines mapping
  const affectedEngines = {
    1: [ // GEnx-1B S/B 79-0234
      {
        serial: 'GE1B-4501',
        aircraft: 'N78801',
        position: 1,
        tsn: 8234,
        csn: 4567,
        location: 'KSFO',
        complianceStatus: 'PENDING',
        dueDate: '2025-11-15',
        daysRemaining: 33,
        workOrder: null,
        manhours: 12,
        notes: 'FMU bypass valve plug clearance check required'
      },
      {
        serial: 'GE1B-4502',
        aircraft: 'N78802',
        position: 2,
        tsn: 7891,
        csn: 4234,
        location: 'KLAX',
        complianceStatus: 'IN_PROGRESS',
        dueDate: '2025-11-20',
        daysRemaining: 38,
        workOrder: 'WO-2025-3001',
        manhours: 12,
        notes: 'Special tooling arrived, work commenced'
      },
      {
        serial: 'GE1B-4503',
        aircraft: 'N78803',
        position: 1,
        tsn: 9456,
        csn: 5012,
        location: 'KJFK',
        complianceStatus: 'PENDING',
        dueDate: '2025-11-25',
        daysRemaining: 43,
        workOrder: null,
        manhours: 12,
        notes: null
      }
    ],
    2: [ // LEAP-1A S/B 72-1567
      {
        serial: 'LEAP1A-6701',
        aircraft: 'N32101',
        position: 1,
        tsn: 12345,
        csn: 6789,
        location: 'KATL',
        complianceStatus: 'PENDING',
        dueDate: 'Next Visit',
        daysRemaining: null,
        workOrder: null,
        manhours: 8,
        notes: 'Schedule at next shop visit'
      },
      {
        serial: 'LEAP1A-6702',
        aircraft: 'N32102',
        position: 2,
        tsn: 11234,
        csn: 6123,
        location: 'KORD',
        complianceStatus: 'PENDING',
        dueDate: 'Next Visit',
        daysRemaining: null,
        workOrder: null,
        manhours: 8,
        notes: null
      }
    ],
    3: [ // LEAP-1A S/B 73-2891
      {
        serial: 'LEAP1A-8801',
        aircraft: 'N32201',
        position: 1,
        tsn: 15678,
        csn: 8234,
        location: 'KJFK',
        complianceStatus: 'OVERDUE',
        dueDate: '2025-10-05',
        daysRemaining: -8,
        workOrder: 'WO-2025-3105',
        manhours: 16,
        notes: 'CRITICAL - Bearing spring finger housing wear detected'
      },
      {
        serial: 'LEAP1A-8802',
        aircraft: 'N32202',
        position: 2,
        tsn: 14234,
        csn: 7456,
        location: 'KLAX',
        complianceStatus: 'IN_PROGRESS',
        dueDate: '2025-10-20',
        daysRemaining: 7,
        workOrder: 'WO-2025-3089',
        manhours: 16,
        notes: 'Special inspection tools on site'
      }
    ],
    4: [ // GEnx-1B S/B 72-4567
      {
        serial: 'GE1B-5601',
        aircraft: 'N78901',
        position: 1,
        tsn: 18234,
        csn: 9456,
        location: 'KSFO',
        complianceStatus: 'PENDING',
        dueDate: '2026-01-10',
        daysRemaining: 89,
        workOrder: null,
        manhours: 10,
        notes: 'HPT blade inspection - borescope required'
      }
    ],
    5: [ // LEAP-1B S/B 78-3421
      {
        serial: 'LEAP1B-9901',
        aircraft: 'N73701',
        position: 1,
        tsn: 9876,
        csn: 5234,
        location: 'KSEA',
        complianceStatus: 'PENDING',
        dueDate: '2025-11-25',
        daysRemaining: 43,
        workOrder: null,
        manhours: 14,
        notes: 'Fan blade leading edge inspection - eddy current kit required'
      },
      {
        serial: 'LEAP1B-9902',
        aircraft: 'N73702',
        position: 2,
        tsn: 10234,
        csn: 5678,
        location: 'KDEN',
        complianceStatus: 'IN_PROGRESS',
        dueDate: '2025-11-20',
        daysRemaining: 38,
        workOrder: 'WO-2025-3156',
        manhours: 14,
        notes: 'Inspection in progress'
      }
    ],
    6: [ // GEnx-1B S/B 79-5678
      {
        serial: 'GE1B-6701',
        aircraft: 'N78905',
        position: 1,
        tsn: 19234,
        csn: 10123,
        location: 'KSFO',
        complianceStatus: 'PENDING',
        dueDate: 'Next Inspection',
        daysRemaining: null,
        workOrder: null,
        manhours: 18,
        notes: 'Combustion chamber liner - recommended at next major'
      }
    ],
    7: [ // LEAP-1A S/B 72-6789
      {
        serial: 'LEAP1A-7801',
        aircraft: 'N32301',
        position: 1,
        tsn: 14567,
        csn: 7890,
        location: 'KATL',
        complianceStatus: 'PENDING',
        dueDate: '2025-11-05',
        daysRemaining: 23,
        workOrder: null,
        manhours: 20,
        notes: 'LPT seal replacement - LEAP-1A26 and above'
      }
    ],
    8: [ // LEAP-1B S/B 79-8901
      {
        serial: 'LEAP1B-5501',
        aircraft: 'N73801',
        position: 1,
        tsn: 11234,
        csn: 6012,
        location: 'KMIA',
        complianceStatus: 'PENDING',
        dueDate: 'Optional',
        daysRemaining: null,
        workOrder: null,
        manhours: 4,
        notes: 'Oil filter replacement - optional'
      }
    ],
    9: [ // GEnx-1B S/B 73-1234
      {
        serial: 'GE1B-7801',
        aircraft: 'N78910',
        position: 1,
        tsn: 7234,
        csn: 3890,
        location: 'KJFK',
        complianceStatus: 'OVERDUE',
        dueDate: '2025-10-08',
        daysRemaining: -5,
        workOrder: 'WO-2025-3234',
        manhours: 8,
        notes: 'CRITICAL - Fan blade vibration damper - GEnx-1B70/P1 variant'
      }
    ],
    10: [ // LEAP-1A S/B 72-4561
      {
        serial: 'LEAP1A-4401',
        aircraft: 'N32401',
        position: 1,
        tsn: 13890,
        csn: 7345,
        location: 'KBOS',
        complianceStatus: 'PENDING',
        dueDate: 'Next Visit',
        daysRemaining: null,
        workOrder: null,
        manhours: 6,
        notes: 'Fuel nozzle flow test - recommended'
      }
    ]
  };

  const getCategoryColor = (category) => {
    const colors = {
      MANDATORY: 'bg-red-100 text-red-800 border-red-300',
      ALERT: 'bg-orange-100 text-orange-800 border-orange-300',
      RECOMMENDED: 'bg-blue-100 text-blue-800 border-blue-300',
      OPTIONAL: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colors[category] || colors.OPTIONAL;
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      OVERDUE: 'bg-red-100 text-red-800'
    };
    return colors[status] || colors.PENDING;
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'CRITICAL') return <AlertTriangle className="w-4 h-4 text-red-600" />;
    if (priority === 'HIGH') return <AlertTriangle className="w-4 h-4 text-orange-600" />;
    return <Clock className="w-4 h-4 text-blue-600" />;
  };

  const filteredSBs = serviceBulletins.filter(sb => {
    const matchesCategory = filterCategory === 'ALL' || sb.category === filterCategory;
    const matchesSearch = sb.sbNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sb.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sb.engineModel.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const currentEngines = selectedSB ? (affectedEngines[selectedSB.id] || []) : [];

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: chatInput,
      timestamp: new Date().toLocaleTimeString()
    };
    
    setChatMessages([...chatMessages, userMessage]);
    
    setTimeout(() => {
      let aiResponse = '';
      
      if (selectedSB && expandedEngine) {
        aiResponse = `**Engine ${expandedEngine.serial} Analysis:**\n\nCompliance Status: ${expandedEngine.complianceStatus}\n• Due Date: ${expandedEngine.dueDate} (${expandedEngine.daysRemaining > 0 ? expandedEngine.daysRemaining + ' days remaining' : expandedEngine.daysRemaining < 0 ? Math.abs(expandedEngine.daysRemaining) + ' days overdue' : 'No specific deadline'})\n• Current Usage: ${expandedEngine.tsn.toLocaleString()} TSN, ${expandedEngine.csn.toLocaleString()} CSN\n• Location: ${expandedEngine.location} on ${expandedEngine.aircraft}\n• Estimated Manhours: ${expandedEngine.manhours}\n\n**Recommendation:** ${expandedEngine.complianceStatus === 'OVERDUE' ? 'IMMEDIATE ACTION REQUIRED - This engine is overdue for SB compliance. Schedule maintenance as soon as possible to avoid operational disruption.' : expandedEngine.complianceStatus === 'IN_PROGRESS' ? 'Work is currently in progress. Monitor completion timeline.' : 'Schedule compliance work to align with aircraft maintenance schedule.'}${expandedEngine.notes ? '\n\n**Notes:** ' + expandedEngine.notes : ''}`;
      } else if (selectedSB) {
        const pending = currentEngines.filter(e => e.complianceStatus === 'PENDING').length;
        const inProgress = currentEngines.filter(e => e.complianceStatus === 'IN_PROGRESS').length;
        const completed = currentEngines.filter(e => e.complianceStatus === 'COMPLETED').length;
        const overdue = currentEngines.filter(e => e.complianceStatus === 'OVERDUE').length;
        
        aiResponse = `**Service Bulletin Analysis: ${selectedSB.sbNumber}**\n\n**Overview:**\n• Category: ${selectedSB.category}\n• Priority: ${selectedSB.priority}\n• Affected: ${selectedSB.affectedCount} of ${selectedSB.totalFleet} ${selectedSB.engineModel} engines (${((selectedSB.affectedCount/selectedSB.totalFleet)*100).toFixed(1)}%)\n• Compliance: ${selectedSB.complianceTime}\n• Issue Date: ${selectedSB.issueDate}\n\n**Fleet Status:**\n• Completed: ${completed} engines\n• In Progress: ${inProgress} engines\n• Pending: ${pending} engines\n• Overdue: ${overdue} engines\n\n**Impact Assessment:**\nThis ${selectedSB.category.toLowerCase()} service bulletin for ${selectedSB.engineModel} requires attention. ${overdue > 0 ? `CRITICAL: ${overdue} engine(s) are overdue for compliance. ` : ''}${selectedSB.category === 'MANDATORY' ? 'As a mandatory SB, compliance planning should be prioritized to ensure continued airworthiness.' : 'Review with engineering team for optimal implementation strategy.'}\n\n**Resource Impact:**\n• Estimated Manhours: ${selectedSB.estimatedManhours} hrs per engine\n• Total Fleet Impact: ~${selectedSB.affectedCount * selectedSB.estimatedManhours} hours\n• Parts Required: ${selectedSB.partsRequired}\n• Tooling: ${selectedSB.toolingRequired}`;
      } else {
        aiResponse = "Welcome to the SB Investigation AI Assistant! 👋\n\nI can help you:\n• Analyze service bulletin impacts on your GEnx and LEAP engine fleet\n• Assess compliance timelines and priorities\n• Suggest optimal maintenance scheduling strategies\n• Provide detailed engine-specific recommendations\n• Calculate resource requirements\n\nPlease select a Service Bulletin from the left panel to begin, or ask me any questions about SB compliance management.";
      }
      
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setChatMessages(prev => [...prev, aiMessage]);
    }, 1000);
    
    setChatInput('');
  };

  const quickActions = [
    { icon: FileText, label: 'Summarize SB', action: 'Give me a detailed summary of this service bulletin and its fleet impact' },
    { icon: TrendingUp, label: 'Fleet Impact', action: 'Analyze the fleet-wide impact and prioritize affected engines by urgency' },
    { icon: Calendar, label: 'Schedule Plan', action: 'Suggest an optimal compliance schedule considering aircraft rotations and maintenance windows' },
  ];

  const toggleEngineExpansion = (engine) => {
    setExpandedEngine(expandedEngine?.serial === engine.serial ? null : engine);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Bulletin Assist</h1>
            <p className="text-sm text-gray-600 mt-1">AI-Assisted GEnx & LEAP Engine Fleet Impact Analysis</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="w-4 h-4" />
              Export Report
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <Mail className="w-4 h-4" />
              Send Summary
            </button>
          </div>
        </div>
      </div>

      {/* 2-Pane Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANE: Service Bulletins List */}
        <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search SB number, title, model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {['ALL', 'MANDATORY', 'ALERT', 'RECOMMENDED', 'OPTIONAL'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredSBs.map(sb => (
              <div
                key={sb.id}
                onClick={() => {
                  setSelectedSB(sb);
                  setExpandedEngine(null);
                }}
                className={`p-4 border-b border-gray-200 cursor-pointer transition-colors ${
                  selectedSB?.id === sb.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getPriorityIcon(sb.priority)}
                    <span className="font-mono text-sm font-semibold text-gray-900">{sb.sbNumber}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(sb.category)}`}>
                    {sb.category}
                  </span>
                </div>
                
                <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{sb.title}</h3>
                
                <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                  <span>{sb.engineModel}</span>
                  <span>{sb.oem}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-600">
                    <span className="font-medium text-gray-900">{sb.affectedCount}</span> / {sb.totalFleet} engines
                  </div>
                  <div className="w-20 bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${(sb.affectedCount / sb.totalFleet) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {filteredSBs.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <p>No service bulletins found</p>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE PANE: SB Summary + Affected Engines */}
        <div className="w-[520px] bg-white border-r border-gray-200 flex flex-col">
          {selectedSB ? (
            <>
              {/* SB Summary Section */}
              <div className="border-b border-gray-200">
                <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getPriorityIcon(selectedSB.priority)}
                        <h2 className="text-lg font-bold text-gray-900">{selectedSB.sbNumber}</h2>
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${getCategoryColor(selectedSB.category)}`}>
                          {selectedSB.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 font-medium mb-3">{selectedSB.title}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                      <div className="text-xs text-gray-600 mb-1">OEM</div>
                      <div className="text-sm font-semibold text-gray-900">{selectedSB.oem}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                      <div className="text-xs text-gray-600 mb-1">Engine Model</div>
                      <div className="text-sm font-semibold text-gray-900">{selectedSB.engineModel}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                    <div className="bg-white rounded p-2">
                      <span className="text-gray-600 block mb-1">Revision</span>
                      <span className="font-semibold text-gray-900">{selectedSB.revision}</span>
                    </div>
                    <div className="bg-white rounded p-2">
                      <span className="text-gray-600 block mb-1">Issue Date</span>
                      <span className="font-semibold text-gray-900">{selectedSB.issueDate}</span>
                    </div>
                    <div className="bg-white rounded p-2">
                      <span className="text-gray-600 block mb-1">Affected</span>
                      <span className="font-semibold text-gray-900">{selectedSB.affectedCount}/{selectedSB.totalFleet}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="bg-white rounded p-2">
                      <span className="text-gray-600 block mb-1">Est. Manhours</span>
                      <span className="font-semibold text-gray-900">{selectedSB.estimatedManhours} hrs</span>
                    </div>
                    <div className="bg-white rounded p-2">
                      <span className="text-gray-600 block mb-1">Parts Required</span>
                      <span className="font-semibold text-gray-900">{selectedSB.partsRequired}</span>
                    </div>
                  </div>

                  {selectedSB.toolingRequired && (
                    <div className="bg-white rounded p-2 text-xs mb-3">
                      <span className="text-gray-600">Tooling: </span>
                      <span className="font-semibold text-gray-900">{selectedSB.toolingRequired}</span>
                    </div>
                  )}

                  {selectedSB.applicabilityScope && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs mb-3">
                      <span className="text-blue-700 font-semibold">Applicability: </span>
                      <span className="text-blue-900">{selectedSB.applicabilityScope}</span>
                    </div>
                  )}

                  {selectedSB.supersedes && (
                    <div className="bg-white rounded p-2 text-xs">
                      <span className="text-gray-600">Supersedes: </span>
                      <span className="font-mono font-semibold text-gray-900">{selectedSB.supersedes}</span>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900">Compliance Time</span>
                  </div>
                  <p className="text-sm text-gray-700">{selectedSB.complianceTime}</p>
                </div>
              </div>

              {/* Affected Engines List */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-3 bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase">
                    Affected Engines ({currentEngines.length})
                  </h3>
                </div>
                
                {currentEngines.map(engine => (
                  <div key={engine.serial} className="border-b border-gray-200">
                    <div
                      onClick={() => toggleEngineExpansion(engine)}
                      className={`p-3 cursor-pointer transition-colors ${
                        expandedEngine?.serial === engine.serial ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold text-gray-900">{engine.serial}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(engine.complianceStatus)}`}>
                              {engine.complianceStatus.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {engine.aircraft} • Position #{engine.position} • {engine.location}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {engine.daysRemaining !== null && engine.daysRemaining < 14 && engine.complianceStatus !== 'COMPLETED' && (
                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                          )}
                          {expandedEngine?.serial === engine.serial ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedEngine?.serial === engine.serial && (
                      <div className="bg-gray-50 border-t border-gray-200 p-4">
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-2">
                              <Wrench className="w-4 h-4" />
                              Engine Configuration
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="text-xs text-gray-600 mb-1">Time Since New</div>
                                <div className="text-lg font-bold text-gray-900">{engine.tsn.toLocaleString()}</div>
                                <div className="text-xs text-gray-500">hours</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="text-xs text-gray-600 mb-1">Cycles Since New</div>
                                <div className="text-lg font-bold text-gray-900">{engine.csn.toLocaleString()}</div>
                                <div className="text-xs text-gray-500">cycles</div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-2">
                              <MapPin className="w-4 h-4" />
                              Location & Assignment
                            </h4>
                            <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Aircraft</span>
                                <span className="font-mono font-semibold text-gray-900">{engine.aircraft}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Position</span>
                                <span className="font-semibold text-gray-900">#{engine.position}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Current Location</span>
                                <span className="font-semibold text-gray-900">{engine.location}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              Compliance Status
                            </h4>
                            <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Status</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(engine.complianceStatus)}`}>
                                  {engine.complianceStatus.replace('_', ' ')}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Due Date</span>
                                <span className="font-semibold text-gray-900">{engine.dueDate}</span>
                              </div>
                              {engine.daysRemaining !== null && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Days Remaining</span>
                                  <span className={`font-bold ${
                                    engine.daysRemaining < 0 ? 'text-red-600' :
                                    engine.daysRemaining < 14 ? 'text-orange-600' :
                                    'text-green-600'
                                  }`}>
                                    {engine.daysRemaining < 0 ? 
                                      `${Math.abs(engine.daysRemaining)} days overdue` : 
                                      `${engine.daysRemaining} days`
                                    }
                                  </span>
                                </div>
                              )}
                              {engine.workOrder && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Work Order</span>
                                  <span className="font-mono font-semibold text-blue-600">{engine.workOrder}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Est. Manhours</span>
                                <span className="font-semibold text-gray-900">{engine.manhours} hrs</span>
                              </div>
                            </div>
                          </div>

                          {engine.notes && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                              <div className="text-xs font-semibold text-yellow-800 mb-1">Notes</div>
                              <div className="text-xs text-yellow-900">{engine.notes}</div>
                            </div>
                          )}

                          {engine.complianceStatus !== 'COMPLETED' && (
                            <div className="flex gap-2 pt-2">
                              <button className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                                Schedule Work
                              </button>
                              <button className="flex-1 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                                View History
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center p-6">
                <Filter className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No Selection</p>
                <p className="text-sm">Select a GEnx or LEAP Service Bulletin to view details and affected engines</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANE: AI Assistant */}
        <div className="flex-1 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
                <p className="text-xs text-gray-600">GEnx & LEAP Engine SB Compliance & Fleet Impact Analysis</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">GEnx & LEAP Fleet Intelligence</h3>
                <p className="text-sm text-gray-600 mb-6 max-w-md">
                  I specialize in GE Aviation (GEnx) and CFM International (LEAP) engine service bulletins. I can help you analyze fleet impacts, optimize compliance scheduling, assess resource requirements, and identify critical safety alerts.
                </p>
                
                <div className="w-full max-w-lg space-y-2">
                  {quickActions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (selectedSB) {
                          setChatInput(action.action);
                        }
                      }}
                      disabled={!selectedSB}
                      className={`w-full flex items-center gap-3 p-3 border rounded-lg text-left transition-colors ${
                        selectedSB 
                          ? 'border-gray-200 bg-white hover:bg-gray-50 hover:border-blue-300' 
                          : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <action.icon className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{action.label}</div>
                        <div className="text-xs text-gray-500">{action.action}</div>
                      </div>
                    </button>
                  ))}
                </div>
                
                {!selectedSB && (
                  <p className="text-xs text-gray-500 mt-4">Select a Service Bulletin to enable AI assistance</p>
                )}
              </div>
            ) : (
              <>
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${msg.type === 'user' ? 'order-2' : 'order-1'}`}>
                      <div className={`rounded-lg p-3 ${
                        msg.type === 'user' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <div className="text-sm whitespace-pre-line">{msg.content}</div>
                      </div>
                      <div className={`text-xs text-gray-500 mt-1 ${msg.type === 'user' ? 'text-right' : 'text-left'}`}>
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={selectedSB ? "Ask about this service bulletin..." : "Select a SB to start chatting..."}
                disabled={!selectedSB}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || !selectedSB}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SBInvestigationDashboard;