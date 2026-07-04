import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react';
import client from '../api/client';

const RiskScoreCard = ({ overallScore, riskLevel }) => {
  const getScoreColor = (score) => {
    if (score <= 30) return 'from-green-400 to-green-600';
    if (score <= 60) return 'from-yellow-400 to-yellow-600';
    return 'from-red-400 to-red-600';
  };

  const getLevelBg = (level) => {
    if (level === 'Low') return 'bg-green-100 text-green-800';
    if (level === 'Medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className={`bg-gradient-to-br ${getScoreColor(overallScore)} rounded-lg p-8 text-white shadow-lg`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <p className="text-sm font-semibold opacity-90">Overall Risk Score</p>
          <h2 className="text-5xl font-bold mt-2">{overallScore}</h2>
        </div>
        <TrendingUp className="w-12 h-12 opacity-80" />
      </div>
      <div className={`inline-block ${getLevelBg(riskLevel)} px-4 py-2 rounded-full text-sm font-semibold`}>
        {riskLevel} Risk
      </div>
    </div>
  );
};

const RiskBreakdown = ({ breakdown }) => {
  const normalizedBreakdown = {
    clause_risk: breakdown?.clause_risk ?? breakdown?.clauseRisk ?? 0,
    missing_clauses: breakdown?.missing_clauses ?? breakdown?.missingClauses ?? 0,
    risky_language: breakdown?.risky_language ?? breakdown?.riskyLanguage ?? 0,
    financial_risk: breakdown?.financial_risk ?? breakdown?.financialRisk ?? 0,
  };

  const categories = [
    { name: 'Clause Risk', value: normalizedBreakdown.clause_risk, icon: '📋' },
    { name: 'Missing Clauses', value: normalizedBreakdown.missing_clauses, icon: '❌' },
    { name: 'Risky Language', value: normalizedBreakdown.risky_language, icon: '⚠️' },
    { name: 'Financial Risk', value: normalizedBreakdown.financial_risk, icon: '💰' },
  ];

  return (
    <div className="bg-white rounded-lg p-6 shadow">
     <h3 className="text-xl font-bold mb-6" style={{ color: 'black' }}>Risk Breakdown</h3>
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category.name}>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">
                {category.icon} {category.name}
              </label>
              <span className="text-sm font-bold text-gray-900">{Math.round(category.value * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${category.value * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MissingClauses = ({ missingClauses }) => {
  if (!missingClauses || missingClauses.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <h3 className="text-xl font-bold" style={{ color: 'black' }}>Missing Clauses</h3>
        </div>
        <p className="text-gray-600">All standard clauses are present.</p>
      </div>
    );
  }

  const getImportanceBg = (importance) => {
    if (importance === 'high') return 'bg-red-100 text-red-800';
    if (importance === 'medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-6 h-6 text-orange-600" />
        <h3 className="text-xl font-bold" style={{ color: 'black' }}>Missing Clauses</h3>
      </div>
      <div className="space-y-4">
        {missingClauses.map((clause, idx) => {
          const clauseName = clause.clause_name ?? clause.clauseName ?? 'Unknown clause';
          const importance = clause.importance ?? 'medium';
          const riskIfMissing = clause.risk_if_missing ?? clause.riskIfMissing ?? '';
          const description = clause.description ?? '';
          const recommendation = clause.recommendation ?? '';

          return (
          <div key={idx} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-gray-900">{clauseName}</h4>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getImportanceBg(importance)}`}>
                {importance.charAt(0).toUpperCase() + importance.slice(1)} Importance
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{description}</p>
            <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
              <p className="text-sm text-orange-900 font-semibold" style={{ color: 'black' }}>Risk if missing:</p>
              <p className="text-sm text-orange-800" style={{ color: 'black' }}>{riskIfMissing}</p>
            </div>
            <p className="text-sm text-gray-700 mt-3">
              <strong>Recommendation:</strong> {recommendation}
            </p>
          </div>
        );
        })}
      </div>
    </div>
  );
};

const RiskyLanguage = ({ riskyItems }) => {
  if (!riskyItems || riskyItems.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 shadow">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <h3 className="text-xl font-bold" style={{ color: 'black' }}>Risky Language</h3>
        </div>
        <p className="text-gray-600">No suspicious language patterns detected.</p>
      </div>
    );
  }

  const getRiskColor = (level) => {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'high') return 'border-red-400 bg-red-50';
    return 'border-yellow-400 bg-yellow-50';
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <h3 className="text-xl font-bold" style={{ color: 'black' }}>Risky Language Detected</h3>
      </div>
      <div className="space-y-4">
        {riskyItems.map((item, idx) => {
          const riskLevel = item.risk_level ?? item.riskLevel ?? 'Medium';
          const normalizedLevel = String(riskLevel).toLowerCase() === 'high' ? 'High' : 'Medium';
          const riskType = item.risk_type ?? item.riskType ?? item.riskId?.replace(/_/g, ' ') ?? 'Risk';
          const context = item.context ?? '';
          const patternMatch = context.match(
            /non[- ]?refundable|unlimited|penalty|automatic renew|indemnif/i
          )?.[0];
          const detectedText =
            item.detected_text ??
            item.detectedText ??
            patternMatch ??
            (context.slice(0, 120) || 'Risky language detected');
          const explanation = item.explanation ?? '';

          return (
          <div key={idx} className={`border-2 rounded-lg p-4 ${getRiskColor(riskLevel)}`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-gray-900">{riskType}</h4>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                normalizedLevel === 'High' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
              }`}>
                {normalizedLevel} Risk
              </span>
            </div>
            <div className="bg-white p-3 rounded my-2 border border-gray-200">
              <p className="text-sm font-mono text-gray-800">"{detectedText}"</p>
            </div>
            <p className="text-sm text-gray-700 mb-2"><strong>Explanation:</strong> {explanation}</p>
            <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded">
              <p className="font-semibold mb-1">Context:</p>
              <p className="italic">...{context.substring(0, 100)}...</p>
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
};

const RecommendationsPanel = ({ recommendations }) => {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const getPriorityColor = (priority) => {
    if (priority === 'Critical') return 'border-red-400 bg-red-50';
    if (priority === 'High') return 'border-orange-400 bg-orange-50';
    if (priority === 'Medium') return 'border-yellow-400 bg-yellow-50';
    return 'border-blue-400 bg-blue-50';
  };

  const getPriorityBadge = (priority) => {
    if (priority === 'Critical') return 'bg-red-200 text-red-800';
    if (priority === 'High') return 'bg-orange-200 text-orange-800';
    if (priority === 'Medium') return 'bg-yellow-200 text-yellow-800';
    return 'bg-blue-200 text-blue-800';
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2" >
        💡 Recommendations
      </h3>
      <div className="space-y-4">
        {recommendations.map((rec, idx) => (
          <div key={idx} className={`border-l-4 rounded-lg p-4 ${getPriorityColor(rec.priority)}`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-gray-900">{rec.action}</h4>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPriorityBadge(rec.priority)}`}>
                {rec.priority}
              </span>
            </div>
            <p className="text-sm text-gray-700 mb-2"><strong>Type:</strong> {rec.type}</p>
            <p className="text-sm text-gray-700"><strong>Rationale:</strong> {rec.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const FinancialRisks = ({ financialRisks }) => {
  if (!financialRisks) return null;

  const riskLevel = financialRisks.risk_level ?? financialRisks.riskLevel ?? 'Low';
  const deposits = financialRisks.deposits ?? [];
  const fees = financialRisks.fees ?? [];
  const penalties = financialRisks.penalties ?? [];

  const getRiskBg = () => {
    if (riskLevel === 'High') return 'bg-red-50 border-red-200';
    if (riskLevel === 'Medium') return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  return (
    <div className={`border-2 rounded-lg p-6 ${getRiskBg()}`}>
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-6 h-6 text-orange-600" />
        <h3 className="text-xl font-bold" style={{ color: 'black' }}>Financial Risks</h3>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold ${
          riskLevel === 'High' ? 'bg-red-200 text-red-800' : 
          riskLevel === 'Medium' ? 'bg-yellow-200 text-yellow-800' :
          'bg-green-200 text-green-800'
        }`}>
          {riskLevel} Risk
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deposits.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">💳 Deposits</h4>
            <div className="space-y-1">
              {deposits.map((dep, idx) => (
                <p key={idx} className="text-sm text-gray-700 bg-white p-2 rounded">{dep}</p>
              ))}
            </div>
          </div>
        )}
        {fees.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">📋 Fees</h4>
            <div className="space-y-1">
              {fees.map((fee, idx) => (
                <p key={idx} className="text-sm text-gray-700 bg-white p-2 rounded">{fee}</p>
              ))}
            </div>
          </div>
        )}
        {penalties.length > 0 && (
          <div className="md:col-span-2">
            <h4 className="font-semibold text-gray-900 mb-2">⚠️ Penalties</h4>
            <div className="space-y-1">
              {penalties.map((pen, idx) => (
                <p key={idx} className="text-sm text-gray-700 bg-white p-2 rounded">{pen}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { RiskScoreCard, RiskBreakdown, MissingClauses, RiskyLanguage, RecommendationsPanel, FinancialRisks };
