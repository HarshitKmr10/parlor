'use client';

import React, { useState } from 'react';
import { Search, TrendingUp, Users, Target, Mail, CheckCircle, AlertCircle, Calendar, BarChart3, MessageSquare, Zap, Brain, ArrowRight, ChevronRight, Filter, Download, RefreshCw } from 'lucide-react';
import withAuth from '@/components/withAuth';

const LeadCopilot = () => {
  const [selectedTrigger, setSelectedTrigger] = useState('intent-signals');
  const [selectedLead, setSelectedLead] = useState(null);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your Lead Intelligence Co-pilot. Ask me anything about your leads, targeting strategies, or engagement insights.' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    status: [],
    score: { min: 0, max: 100 },
    industry: [],
    companySize: []
  });
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    type: 'abm',
    icp: {
      industry: [],
      companySize: [],
      revenue: [],
      geography: [],
      techStack: []
    },
    targeting: {
      jobTitles: [],
      seniority: [],
      departments: []
    },
    intent: {
      signals: [],
      threshold: 'medium'
    }
  });

  // Mock data for triggers
  const triggers = [
    {
      id: 'intent-signals',
      name: 'High Intent Signals',
      icon: <TrendingUp className="w-4 h-4" />,
      count: 5,
      status: 'active',
      description: 'Companies showing buying behavior'
    },
    {
      id: 'tech-adoption',
      name: 'Tech Stack Changes',
      icon: <Zap className="w-4 h-4" />,
      count: 3,
      status: 'active',
      description: 'New technology implementations detected'
    },
    {
      id: 'funding-events',
      name: 'Funding Events',
      icon: <Target className="w-4 h-4" />,
      count: 2,
      status: 'active',
      description: 'Recent funding rounds'
    },
    {
      id: 'hiring-trends',
      name: 'Hiring Expansion',
      icon: <Users className="w-4 h-4" />,
      count: 2,
      status: 'active',
      description: 'Companies hiring in key roles'
    },
    {
      id: 'engagement',
      name: 'Website Engagement',
      icon: <MessageSquare className="w-4 h-4" />,
      count: 2,
      status: 'monitoring',
      description: 'High website activity'
    }
  ];

  // Mock leads data
  const leadsData = {
    'intent-signals': [
      {
        id: 1,
        company: 'TechCorp Solutions',
        contact: 'Sarah Chen',
        title: 'VP of Sales',
        score: 92,
        status: 'hot',
        intent: 'Researching CRM solutions',
        industry: 'SaaS',
        employees: '250-500',
        revenue: '$50M-100M',
        signals: ['Multiple page visits', 'Pricing page view', 'Demo video watched'],
        enriched: true,
        lastActivity: '2 hours ago'
      },
      {
        id: 2,
        company: 'DataDrive Inc',
        contact: 'Michael Roberts',
        title: 'CTO',
        score: 85,
        status: 'warm',
        intent: 'Evaluating sales automation',
        industry: 'Technology',
        employees: '100-250',
        revenue: '$25M-50M',
        signals: ['Content download', 'LinkedIn engagement'],
        enriched: true,
        lastActivity: '5 hours ago'
      },
      {
        id: 3,
        company: 'CloudScale Systems',
        contact: 'Jennifer Martinez',
        title: 'Head of Revenue Operations',
        score: 88,
        status: 'hot',
        intent: 'Active comparison shopping',
        industry: 'Cloud Services',
        employees: '500-1000',
        revenue: '$100M+',
        signals: ['Competitor comparison', 'ROI calculator used', 'Case study viewed'],
        enriched: true,
        lastActivity: '1 hour ago'
      },
      {
        id: 4,
        company: 'FinTech Innovations',
        contact: 'David Park',
        title: 'Chief Revenue Officer',
        score: 90,
        status: 'hot',
        intent: 'Looking for enterprise solution',
        industry: 'Financial Services',
        employees: '1000-5000',
        revenue: '$500M+',
        signals: ['Demo request submitted', 'Multiple stakeholder visits'],
        enriched: true,
        lastActivity: '30 minutes ago'
      },
      {
        id: 5,
        company: 'Healthcare Plus',
        contact: 'Emily Watson',
        title: 'VP Operations',
        score: 78,
        status: 'warm',
        intent: 'Exploring options',
        industry: 'Healthcare',
        employees: '500-1000',
        revenue: '$100M-500M',
        signals: ['Blog engagement', 'Email opens'],
        enriched: true,
        lastActivity: '4 hours ago'
      }
    ],
    'tech-adoption': [
      {
        id: 6,
        company: 'DevOps Masters',
        contact: 'Alex Thompson',
        title: 'VP Engineering',
        score: 87,
        status: 'hot',
        intent: 'Implementing new CI/CD',
        industry: 'Technology',
        employees: '100-250',
        revenue: '$25M-50M',
        signals: ['Jenkins migration', 'DevOps hiring'],
        enriched: true,
        lastActivity: '1 hour ago'
      },
      {
        id: 7,
        company: 'Cloud Native Co',
        contact: 'Maria Garcia',
        title: 'CTO',
        score: 91,
        status: 'hot',
        intent: 'Kubernetes adoption',
        industry: 'SaaS',
        employees: '250-500',
        revenue: '$50M-100M',
        signals: ['AWS to multi-cloud', 'Container orchestration'],
        enriched: true,
        lastActivity: '45 minutes ago'
      },
      {
        id: 8,
        company: 'Enterprise Systems Inc',
        contact: 'Robert Kim',
        title: 'Director of IT',
        score: 83,
        status: 'warm',
        intent: 'Salesforce implementation',
        industry: 'Manufacturing',
        employees: '1000-5000',
        revenue: '$100M-500M',
        signals: ['CRM evaluation', 'Salesforce job posting'],
        enriched: true,
        lastActivity: '3 hours ago'
      }
    ],
    'funding-events': [
      {
        id: 9,
        company: 'StartupRocket',
        contact: 'Jessica Lee',
        title: 'CEO',
        score: 94,
        status: 'hot',
        intent: 'Scaling operations',
        industry: 'SaaS',
        employees: '51-200',
        revenue: '$10M-$50M',
        signals: ['Series B $50M', 'Aggressive hiring', 'Office expansion'],
        enriched: true,
        lastActivity: '2 hours ago'
      },
      {
        id: 10,
        company: 'GrowthTech Ventures',
        contact: 'Thomas Anderson',
        title: 'CFO',
        score: 89,
        status: 'hot',
        intent: 'Building infrastructure',
        industry: 'Technology',
        employees: '100-250',
        revenue: '$25M-$50M',
        signals: ['Series C $75M', 'International expansion'],
        enriched: true,
        lastActivity: '5 hours ago'
      }
    ],
    'hiring-trends': [
      {
        id: 11,
        company: 'Rapid Growth Corp',
        contact: 'Linda Martinez',
        title: 'VP Sales',
        score: 86,
        status: 'hot',
        intent: 'Building sales team',
        industry: 'SaaS',
        employees: '100-250',
        revenue: '$25M-50M',
        signals: ['20+ sales roles', 'VP Sales hire', 'SDR team expansion'],
        enriched: true,
        lastActivity: '1 hour ago'
      },
      {
        id: 12,
        company: 'TechScale Solutions',
        contact: 'James Wilson',
        title: 'Chief People Officer',
        score: 82,
        status: 'warm',
        intent: 'Department expansion',
        industry: 'Technology',
        employees: '250-500',
        revenue: '$50M-100M',
        signals: ['Engineering hiring', 'Product team growth'],
        enriched: true,
        lastActivity: '2 hours ago'
      }
    ],
    'engagement': [
      {
        id: 13,
        company: 'Digital Dynamics',
        contact: 'Patricia Brown',
        title: 'CMO',
        score: 79,
        status: 'warm',
        intent: 'Research phase',
        industry: 'Marketing',
        employees: '51-200',
        revenue: '$10M-25M',
        signals: ['5+ page visits', 'Resource downloads', 'Newsletter signup'],
        enriched: true,
        lastActivity: '30 minutes ago'
      },
      {
        id: 14,
        company: 'eCommerce Elite',
        contact: 'Steven Davis',
        title: 'VP of Operations',
        score: 81,
        status: 'warm',
        intent: 'Evaluating solutions',
        industry: 'Retail',
        employees: '500-1000',
        revenue: '$100M-500M',
        signals: ['Pricing page', 'Feature comparison', 'Blog engagement'],
        enriched: true,
        lastActivity: '1 hour ago'
      }
    ]
  };

  const agentStatus = [
    { name: 'Market Intelligence', status: 'active', processed: 1243 },
    { name: 'Data Enrichment', status: 'active', processed: 892 },
    { name: 'Engagement', status: 'active', processed: 456 },
    { name: 'Qualification', status: 'active', processed: 234 },
    { name: 'Routing', status: 'active', processed: 178 },
    { name: 'Learning', status: 'optimizing', processed: 2456 }
  ];

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    
    const userMsg = inputMessage.trim();
    let response = '';

    // Generate contextual responses based on user input
    if (userMsg.toLowerCase().includes('score') || userMsg.toLowerCase().includes('scoring')) {
      response = `Based on our lead scoring model, the average score for ${triggers.find(t => t.id === selectedTrigger)?.name} is ${Math.round(filteredLeads.reduce((sum, l) => sum + l.score, 0) / filteredLeads.length)}. High scores (90+) indicate strong buying signals. ${selectedLead ? `${selectedLead.company} scored ${selectedLead.score} due to: ${selectedLead.signals.join(', ')}.` : 'Select a lead to see detailed scoring factors.'}`;
    } else if (userMsg.toLowerCase().includes('email') || userMsg.toLowerCase().includes('outreach')) {
      response = selectedLead 
        ? `I can draft a personalized email for ${selectedLead.contact} at ${selectedLead.company}. Based on their intent (${selectedLead.intent}), I recommend highlighting: 1) How we solve their specific challenge, 2) Relevant case studies from ${selectedLead.industry}, 3) Clear CTA for a 15-min discovery call. Would you like me to generate the full email?`
        : 'Select a lead first, and I\'ll draft a personalized outreach email based on their profile and intent signals.';
    } else if (userMsg.toLowerCase().includes('next') || userMsg.toLowerCase().includes('action')) {
      response = selectedLead
        ? `For ${selectedLead.company} (${selectedLead.status} lead, score: ${selectedLead.score}), I recommend: ${selectedLead.status === 'hot' ? '1) Immediate outreach via phone/email, 2) Offer executive briefing, 3) Share industry-specific ROI calculator' : selectedLead.status === 'warm' ? '1) Send personalized nurture sequence, 2) Invite to upcoming webinar, 3) Share relevant case study' : '1) Add to drip campaign, 2) Monitor for engagement triggers, 3) Re-evaluate in 2 weeks'}. Priority: ${selectedLead.status === 'hot' ? 'HIGH' : selectedLead.status === 'warm' ? 'MEDIUM' : 'LOW'}.`
        : `For the ${filteredLeads.length} leads in ${triggers.find(t => t.id === selectedTrigger)?.name}, prioritize the ${filteredLeads.filter(l => l.status === 'hot').length} hot leads first. They have the highest conversion probability.`;
    } else if (userMsg.toLowerCase().includes('similar') || userMsg.toLowerCase().includes('like')) {
      response = selectedLead
        ? `Finding leads similar to ${selectedLead.company}... Based on industry (${selectedLead.industry}), company size (${selectedLead.employees}), and intent signals, I found ${Math.floor(Math.random() * 5) + 3} comparable prospects. They share similar characteristics: same industry vertical, comparable revenue range, and showing parallel buying signals.`
        : 'Select a lead to find similar prospects based on firmographic and behavioral patterns.';
    } else if (userMsg.toLowerCase().includes('convert') || userMsg.toLowerCase().includes('close')) {
      response = `Based on historical data, leads in the ${triggers.find(t => t.id === selectedTrigger)?.name} category have a ${Math.floor(Math.random() * 20) + 25}% conversion rate. Key success factors: 1) Response time under 2 hours, 2) Personalized messaging, 3) Multi-threaded engagement. ${filteredLeads.filter(l => l.status === 'hot').length} hot leads have 2.5x higher conversion likelihood.`;
    } else if (userMsg.toLowerCase().includes('campaign') || userMsg.toLowerCase().includes('strategy')) {
      response = `For this lead set, I recommend a multi-channel approach: 1) Email sequence (3 touches over 10 days), 2) LinkedIn engagement (connect + message), 3) Targeted content (share relevant case studies). Expected response rate: 18-22%. Focus on value proposition around ${selectedLead ? selectedLead.intent : 'their specific pain points'}.`;
    } else {
      response = `I analyzed your query about "${userMsg}". ${selectedLead ? `For ${selectedLead.company}, ` : ''}The ${filteredLeads.length} leads from ${triggers.find(t => t.id === selectedTrigger)?.name} show strong potential. I recommend prioritizing hot leads (score 85+) for immediate outreach, and nurturing warm leads with targeted content. Would you like specific recommendations for any lead?`;
    }
    
    setChatMessages([...chatMessages, 
      { role: 'user', content: userMsg },
      { role: 'assistant', content: response }
    ]);
    setInputMessage('');
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'hot': return 'text-red-600 bg-red-50';
      case 'warm': return 'text-orange-600 bg-orange-50';
      case 'cold': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const currentLeads = leadsData[selectedTrigger] || [];

  // Enterprise-standard campaign types
  const campaignTypes = [
    { id: 'abm', name: 'Account-Based Marketing (ABM)', description: 'Target specific high-value accounts' },
    { id: 'demand-gen', name: 'Demand Generation', description: 'Broad market awareness and lead generation' },
    { id: 'expansion', name: 'Account Expansion', description: 'Upsell/cross-sell to existing customers' },
    { id: 'competitive', name: 'Competitive Displacement', description: 'Target competitors\' customers' },
    { id: 'event-based', name: 'Event-Based Triggers', description: 'Trigger on specific business events' },
    { id: 'vertical', name: 'Vertical/Industry Focus', description: 'Industry-specific campaigns' }
  ];

  // Standard ICP criteria
  const icpOptions = {
    industry: ['Technology', 'Financial Services', 'Healthcare', 'Manufacturing', 'Retail', 'Education', 'Professional Services', 'SaaS'],
    companySize: ['1-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'],
    revenue: ['<$10M', '$10M-$50M', '$50M-$100M', '$100M-$500M', '$500M-$1B', '$1B+'],
    geography: ['North America', 'EMEA', 'APAC', 'LATAM', 'US - East', 'US - West', 'US - Central'],
    techStack: ['Salesforce', 'HubSpot', 'Microsoft Dynamics', 'Oracle', 'SAP', 'AWS', 'Azure', 'GCP']
  };

  const targetingOptions = {
    jobTitles: ['CEO', 'CTO', 'CFO', 'CMO', 'VP Sales', 'VP Marketing', 'VP Operations', 'Director', 'Head of'],
    seniority: ['C-Level', 'VP', 'Director', 'Manager', 'Individual Contributor'],
    departments: ['Sales', 'Marketing', 'IT', 'Operations', 'Finance', 'Engineering', 'Product', 'Customer Success']
  };

  const intentSignals = [
    'Website Visits', 'Content Downloads', 'Webinar Attendance', 'Pricing Page Views', 
    'Product Comparison', 'Competitor Research', 'Job Postings', 'Funding Events',
    'Tech Stack Changes', 'G2/Review Sites', 'LinkedIn Engagement', 'Email Opens/Clicks'
  ];

  const handleLaunchCampaign = () => {
    setChatMessages([...chatMessages, {
      role: 'assistant',
      content: `Campaign "${campaignForm.name}" launched successfully! Market Intelligence Agent is now scanning for leads matching your ICP criteria. Expected first batch of qualified leads in 15-20 minutes.`
    }]);
    setShowCampaignModal(false);
    setCampaignForm({
      name: '',
      type: 'abm',
      icp: { industry: [], companySize: [], revenue: [], geography: [], techStack: [] },
      targeting: { jobTitles: [], seniority: [], departments: [] },
      intent: { signals: [], threshold: 'medium' }
    });
  };

  const toggleArrayItem = (category, subcategory, item) => {
    setCampaignForm(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [subcategory]: prev[category][subcategory].includes(item)
          ? prev[category][subcategory].filter(i => i !== item)
          : [...prev[category][subcategory], item]
      }
    }));
  };

  const handleExport = () => {
    const csvContent = [
      ['Company', 'Contact', 'Title', 'Score', 'Status', 'Industry', 'Employees', 'Revenue', 'Intent', 'Last Activity'],
      ...filteredLeads.map(lead => [
        lead.company,
        lead.contact,
        lead.title,
        lead.score,
        lead.status,
        lead.industry,
        lead.employees,
        lead.revenue,
        lead.intent,
        lead.lastActivity
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_${selectedTrigger}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const applyFilters = (leads) => {
    return leads.filter(lead => {
      if (filters.status.length > 0 && !filters.status.includes(lead.status)) return false;
      if (lead.score < filters.score.min || lead.score > filters.score.max) return false;
      if (filters.industry.length > 0 && !filters.industry.includes(lead.industry)) return false;
      if (filters.companySize.length > 0 && !filters.companySize.includes(lead.employees)) return false;
      return true;
    });
  };

  const filteredLeads = applyFilters(leadsData[selectedTrigger] || []);

  const activeFilterCount = 
    filters.status.length + 
    filters.industry.length + 
    filters.companySize.length + 
    (filters.score.min > 0 || filters.score.max < 100 ? 1 : 0);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-8">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
              <h2 className="text-2xl font-bold mb-2">Filter Leads</h2>
              <p className="text-blue-100">Refine your lead list</p>
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Lead Status</label>
                <div className="flex flex-wrap gap-2">
                  {['hot', 'warm', 'cold'].map(status => (
                    <button
                      key={status}
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        status: prev.status.includes(status) 
                          ? prev.status.filter(s => s !== status)
                          : [...prev.status, status]
                      }))}
                      className={`px-4 py-2 text-sm rounded-full transition-all ${
                        filters.status.includes(status)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Score Range Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Lead Score Range</label>
                <div className="flex gap-4 items-center">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">Min Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={filters.score.min}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        score: { ...prev.score, min: parseInt(e.target.value) || 0 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="text-gray-400 mt-6">to</div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 mb-1">Max Score</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={filters.score.max}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        score: { ...prev.score, max: parseInt(e.target.value) || 100 }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Industry Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Industry</label>
                <div className="flex flex-wrap gap-2">
                  {['SaaS', 'Technology', 'Financial Services', 'Healthcare', 'Manufacturing', 'Retail', 'Cloud Services', 'Marketing'].map(industry => (
                    <button
                      key={industry}
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        industry: prev.industry.includes(industry)
                          ? prev.industry.filter(i => i !== industry)
                          : [...prev.industry, industry]
                      }))}
                      className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                        filters.industry.includes(industry)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {industry}
                    </button>
                  ))}
                </div>
              </div>

              {/* Company Size Filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Company Size</label>
                <div className="flex flex-wrap gap-2">
                  {['1-50', '51-200', '100-250', '250-500', '500-1000', '1000-5000'].map(size => (
                    <button
                      key={size}
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        companySize: prev.companySize.includes(size)
                          ? prev.companySize.filter(s => s !== size)
                          : [...prev.companySize, size]
                      }))}
                      className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                        filters.companySize.includes(size)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
              <button
                onClick={() => setFilters({
                  status: [],
                  score: { min: 0, max: 100 },
                  industry: [],
                  companySize: []
                })}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium transition-all"
              >
                Apply Filters ({filteredLeads.length} leads)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Launch Modal */}
      {showCampaignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl flex-shrink-0">
              <h2 className="text-2xl font-bold mb-2">Launch Lead Generation Campaign</h2>
              <p className="text-blue-100">Configure your ICP and targeting criteria</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Campaign Name & Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({...campaignForm, name: e.target.value})}
                  placeholder="e.g., Q1 2025 Enterprise SaaS ABM"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Campaign Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {campaignTypes.map(type => (
                    <div
                      key={type.id}
                      onClick={() => setCampaignForm({...campaignForm, type: type.id})}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        campaignForm.type === type.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900 mb-1">{type.name}</div>
                      <div className="text-xs text-gray-600">{type.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ICP Definition */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ideal Customer Profile (ICP)</h3>
                
                <div className="space-y-4">
                  {/* Industry */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                    <div className="flex flex-wrap gap-2">
                      {icpOptions.industry.map(industry => (
                        <button
                          key={industry}
                          onClick={() => toggleArrayItem('icp', 'industry', industry)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                            campaignForm.icp.industry.includes(industry)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {industry}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Company Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Company Size (Employees)</label>
                    <div className="flex flex-wrap gap-2">
                      {icpOptions.companySize.map(size => (
                        <button
                          key={size}
                          onClick={() => toggleArrayItem('icp', 'companySize', size)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                            campaignForm.icp.companySize.includes(size)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Revenue */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Annual Revenue</label>
                    <div className="flex flex-wrap gap-2">
                      {icpOptions.revenue.map(rev => (
                        <button
                          key={rev}
                          onClick={() => toggleArrayItem('icp', 'revenue', rev)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                            campaignForm.icp.revenue.includes(rev)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {rev}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Geography */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Geography</label>
                    <div className="flex flex-wrap gap-2">
                      {icpOptions.geography.map(geo => (
                        <button
                          key={geo}
                          onClick={() => toggleArrayItem('icp', 'geography', geo)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                            campaignForm.icp.geography.includes(geo)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {geo}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tech Stack */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tech Stack (Optional)</label>
                    <div className="flex flex-wrap gap-2">
                      {icpOptions.techStack.map(tech => (
                        <button
                          key={tech}
                          onClick={() => toggleArrayItem('icp', 'techStack', tech)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                            campaignForm.icp.techStack.includes(tech)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {tech}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Targeting Criteria */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Targeting</h3>
                
                <div className="space-y-4">
                  {/* Job Titles */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Job Titles / Roles</label>
                    <div className="flex flex-wrap gap-2">
                      {targetingOptions.jobTitles.map(title => (
                        <button
                          key={title}
                          onClick={() => toggleArrayItem('targeting', 'jobTitles', title)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                            campaignForm.targeting.jobTitles.includes(title)
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Seniority */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Seniority Level</label>
                    <div className="flex flex-wrap gap-2">
                      {targetingOptions.seniority.map(level => (
                        <button
                          key={level}
                          onClick={() => toggleArrayItem('targeting', 'seniority', level)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                            campaignForm.targeting.seniority.includes(level)
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Departments */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Departments</label>
                    <div className="flex flex-wrap gap-2">
                      {targetingOptions.departments.map(dept => (
                        <button
                          key={dept}
                          onClick={() => toggleArrayItem('targeting', 'departments', dept)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                            campaignForm.targeting.departments.includes(dept)
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Intent Signals */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Intent Signals</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Monitor These Signals</label>
                    <div className="flex flex-wrap gap-2">
                      {intentSignals.map(signal => (
                        <button
                          key={signal}
                          onClick={() => toggleArrayItem('intent', 'signals', signal)}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                            campaignForm.intent.signals.includes(signal)
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {signal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Intent Threshold</label>
                    <div className="flex gap-3">
                      {['low', 'medium', 'high'].map(threshold => (
                        <button
                          key={threshold}
                          onClick={() => setCampaignForm({...campaignForm, intent: {...campaignForm.intent, threshold}})}
                          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                            campaignForm.intent.threshold === threshold
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium capitalize">{threshold}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            {threshold === 'low' && 'Cast wide net'}
                            {threshold === 'medium' && 'Balanced approach'}
                            {threshold === 'high' && 'High-quality only'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="border-t pt-6 bg-gray-50 -mx-6 px-6 py-4 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Campaign Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Industries:</span>
                    <span className="ml-2 font-medium">{campaignForm.icp.industry.length || 'Any'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Company Sizes:</span>
                    <span className="ml-2 font-medium">{campaignForm.icp.companySize.length || 'Any'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Job Titles:</span>
                    <span className="ml-2 font-medium">{campaignForm.targeting.jobTitles.length || 'Any'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Intent Signals:</span>
                    <span className="ml-2 font-medium">{campaignForm.intent.signals.length || 'None'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
              <button
                onClick={() => setShowCampaignModal(false)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLaunchCampaign}
                disabled={!campaignForm.name}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
              >
                Launch Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT PANE - Triggers & Sources */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Lead Generation Triggers</h2>
          <p className="text-sm text-gray-500">AI-powered lead discovery</p>
          <button
            onClick={() => setShowCampaignModal(true)}
            className="w-full mt-3 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium flex items-center justify-center gap-2 transition-all"
          >
            <Zap className="w-4 h-4" />
            Launch New Campaign
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {triggers.map((trigger) => (
            <div
              key={trigger.id}
              onClick={() => setSelectedTrigger(trigger.id)}
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                selectedTrigger === trigger.id
                  ? 'bg-blue-50 border-2 border-blue-500'
                  : 'bg-gray-50 border-2 border-transparent hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded ${selectedTrigger === trigger.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                    {trigger.icon}
                  </div>
                  <span className="font-medium text-sm text-gray-900">{trigger.name}</span>
                </div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  {trigger.count}
                </span>
              </div>
              <p className="text-xs text-gray-600 ml-8">{trigger.description}</p>
              <div className="flex items-center gap-1 mt-2 ml-8">
                <div className={`w-2 h-2 rounded-full ${trigger.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="text-xs text-gray-500 capitalize">{trigger.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MIDDLE PANE - Lead Insights */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Lead Insights Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                {filteredLeads.length} leads from {triggers.find(t => t.id === selectedTrigger)?.name}
                {activeFilterCount > 0 && ` (${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active)`}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowFilterModal(true)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 relative"
              >
                <Filter className="w-4 h-4" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button 
                onClick={handleExport}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-900">AVG SCORE</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">88.3</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs font-semibold text-green-900">QUALIFIED</span>
              </div>
              <div className="text-2xl font-bold text-green-900">67%</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-semibold text-purple-900">ENGAGED</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">42%</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-semibold text-orange-900">MEETINGS</span>
              </div>
              <div className="text-2xl font-bold text-orange-900">12</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No leads found</h3>
              <p className="text-sm text-gray-500">
                {activeFilterCount > 0 
                  ? 'Try adjusting your filters to see more results'
                  : 'No leads available for this trigger yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedLead?.id === lead.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">{lead.company}</h3>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                          {lead.status.toUpperCase()}
                        </span>
                        {lead.enriched && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                            ENRICHED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="font-medium">{lead.contact}</span>
                        <span>•</span>
                        <span>{lead.title}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{lead.score}</div>
                      <div className="text-xs text-gray-500">Lead Score</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                    <div>
                      <span className="text-gray-500">Industry:</span>
                      <span className="ml-2 font-medium text-gray-900">{lead.industry}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Employees:</span>
                      <span className="ml-2 font-medium text-gray-900">{lead.employees}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Revenue:</span>
                      <span className="ml-2 font-medium text-gray-900">{lead.revenue}</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs font-semibold text-gray-500 mb-2">INTENT SIGNALS</div>
                    <div className="flex flex-wrap gap-2">
                      {lead.signals.map((signal, idx) => (
                        <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <span className="text-xs text-gray-500">Last activity: {lead.lastActivity}</span>
                    <button className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 flex items-center gap-1">
                      View Details
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE - Chat Interface */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-white">AI Co-pilot</h3>
              <p className="text-xs text-blue-100">Lead Intelligence Assistant</p>
            </div>
          </div>
        </div>

        {selectedLead && (
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <div className="text-xs font-semibold text-blue-900 mb-2">CONTEXT</div>
            <div className="text-sm">
              <div className="font-medium text-blue-900">{selectedLead.company}</div>
              <div className="text-blue-700">{selectedLead.contact} • {selectedLead.title}</div>
              <div className="mt-2 text-xs text-blue-600">
                Intent: {selectedLead.intent}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">QUICK ACTIONS</div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => {
                  const msg = 'Draft a personalized email for this lead';
                  setInputMessage(msg);
                  setTimeout(() => {
                    const userMsg = msg;
                    const response = selectedLead 
                      ? `I can draft a personalized email for ${selectedLead.contact} at ${selectedLead.company}. Based on their intent (${selectedLead.intent}), I recommend highlighting: 1) How we solve their specific challenge, 2) Relevant case studies from ${selectedLead.industry}, 3) Clear CTA for a 15-min discovery call. Would you like me to generate the full email?`
                      : 'Select a lead first, and I\'ll draft a personalized outreach email based on their profile and intent signals.';
                    setChatMessages(prev => [...prev, 
                      { role: 'user', content: userMsg },
                      { role: 'assistant', content: response }
                    ]);
                    setInputMessage('');
                  }, 100);
                }}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Draft Email
              </button>
              <button 
                onClick={() => {
                  const msg = 'Analyze the lead score breakdown';
                  setInputMessage(msg);
                  setTimeout(() => {
                    const userMsg = msg;
                    const response = `Based on our lead scoring model, the average score for ${triggers.find(t => t.id === selectedTrigger)?.name} is ${Math.round(filteredLeads.reduce((sum, l) => sum + l.score, 0) / filteredLeads.length)}. High scores (90+) indicate strong buying signals. ${selectedLead ? `${selectedLead.company} scored ${selectedLead.score} due to: ${selectedLead.signals.join(', ')}.` : 'Select a lead to see detailed scoring factors.'}`;
                    setChatMessages(prev => [...prev, 
                      { role: 'user', content: userMsg },
                      { role: 'assistant', content: response }
                    ]);
                    setInputMessage('');
                  }, 100);
                }}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Score Analysis
              </button>
              <button 
                onClick={() => {
                  const msg = 'What is the next best action for this lead?';
                  setInputMessage(msg);
                  setTimeout(() => {
                    const userMsg = msg;
                    const response = selectedLead
                      ? `For ${selectedLead.company} (${selectedLead.status} lead, score: ${selectedLead.score}), I recommend: ${selectedLead.status === 'hot' ? '1) Immediate outreach via phone/email, 2) Offer executive briefing, 3) Share industry-specific ROI calculator' : selectedLead.status === 'warm' ? '1) Send personalized nurture sequence, 2) Invite to upcoming webinar, 3) Share relevant case study' : '1) Add to drip campaign, 2) Monitor for engagement triggers, 3) Re-evaluate in 2 weeks'}. Priority: ${selectedLead.status === 'hot' ? 'HIGH' : selectedLead.status === 'warm' ? 'MEDIUM' : 'LOW'}.`
                      : `For the ${filteredLeads.length} leads in ${triggers.find(t => t.id === selectedTrigger)?.name}, prioritize the ${filteredLeads.filter(l => l.status === 'hot').length} hot leads first. They have the highest conversion probability.`;
                    setChatMessages(prev => [...prev, 
                      { role: 'user', content: userMsg },
                      { role: 'assistant', content: response }
                    ]);
                    setInputMessage('');
                  }, 100);
                }}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Next Best Action
              </button>
              <button 
                onClick={() => {
                  const msg = 'Find similar leads to this one';
                  setInputMessage(msg);
                  setTimeout(() => {
                    const userMsg = msg;
                    const response = selectedLead
                      ? `Finding leads similar to ${selectedLead.company}... Based on industry (${selectedLead.industry}), company size (${selectedLead.employees}), and intent signals, I found ${Math.floor(Math.random() * 5) + 3} comparable prospects. They share similar characteristics: same industry vertical, comparable revenue range, and showing parallel buying signals.`
                      : 'Select a lead to find similar prospects based on firmographic and behavioral patterns.';
                    setChatMessages(prev => [...prev, 
                      { role: 'user', content: userMsg },
                      { role: 'assistant', content: response }
                    ]);
                    setInputMessage('');
                  }, 100);
                }}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                Similar Leads
              </button>
            </div>
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask about leads, strategies, or insights..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendMessage}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withAuth(LeadCopilot);