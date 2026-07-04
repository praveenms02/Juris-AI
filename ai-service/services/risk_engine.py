"""
Legal Risk Analysis Engine

Analyzes legal documents for:
- Risky clauses
- Missing clauses
- One-sided language
- Financial risks
- Compliance issues
- Overall risk scoring
"""

import json
import re
from typing import Any, Dict, List, Optional, Tuple


class RiskEngine:
    """Analyzes legal documents for risks and compliance issues."""

    def __init__(self, llm=None):
        """Initialize risk engine (rule-based — no external LLM required)."""
        self.llm: Optional[Any] = llm  # Optional; only used by async clause analysis
        
        # Risk scoring thresholds
        self.HIGH_RISK_THRESHOLD = 0.7
        self.MEDIUM_RISK_THRESHOLD = 0.4
        
        # Standard clauses that should be present
        self.STANDARD_CLAUSES = {
            "termination": {
                "name": "Termination Clause",
                "importance": "high",
                "description": "Specifies how and when the agreement can be terminated"
            },
            "confidentiality": {
                "name": "Confidentiality/NDA Clause",
                "importance": "high",
                "description": "Protects sensitive information shared between parties"
            },
            "liability": {
                "name": "Liability Clause",
                "importance": "high",
                "description": "Limits liability and specifies remedies for breaches"
            },
            "dispute_resolution": {
                "name": "Dispute Resolution Clause",
                "importance": "high",
                "description": "Specifies how disputes will be handled (mediation, arbitration, court)"
            },
            "force_majeure": {
                "name": "Force Majeure Clause",
                "importance": "medium",
                "description": "Handles performance impossibility due to unforeseeable events"
            },
            "payment_terms": {
                "name": "Payment Terms Clause",
                "importance": "high",
                "description": "Specifies payment amounts, schedules, and methods"
            },
            "renewal": {
                "name": "Renewal Clause",
                "importance": "medium",
                "description": "Specifies renewal terms and automatic renewal conditions"
            },
            "indemnification": {
                "name": "Indemnification Clause",
                "importance": "high",
                "description": "Specifies who bears responsibility for damages"
            }
        }

        # Content keywords used to decide whether a standard clause is present.
        # Avoid generic words like "clause" that cause false positives.
        self.CLAUSE_PRESENCE_KEYWORDS = {
            "termination": ["termination", "terminate", "notice period", "end of agreement", "vacate"],
            "confidentiality": ["confidential", "non-disclosure", "nda", "proprietary information"],
            "liability": ["liability", "limitation of liability", "liable for", "damages"],
            "dispute_resolution": ["dispute", "arbitration", "mediation", "governing law", "jurisdiction"],
            "force_majeure": ["force majeure", "act of god", "unforeseen event"],
            "payment_terms": ["payment", "rent", "fee", "consideration", "payable", "monthly rent"],
            "renewal": ["renewal", "renew", "extension of term", "auto-renew"],
            "indemnification": ["indemnif", "hold harmless", "indemnity"],
        }
        
        # Risky language patterns
        self.RISKY_PHRASES = {
            "unlimited_liability": {
                "patterns": [
                    r"unlimited liability",
                    r"unlimited damages",
                    r"without limit",
                    r"in excess of.*liability"
                ],
                "risk_level": "high",
                "explanation": "Exposes one party to unlimited financial liability"
            },
            "non_refundable": {
                "patterns": [
                    r"non-refundable",
                    r"non refundable",
                    r"no refunds",
                    r"all sales final"
                ],
                "risk_level": "medium",
                "explanation": "Prevents recovery of payments in certain conditions"
            },
            "automatic_renewal": {
                "patterns": [
                    r"automatic renewal",
                    r"automatically renew",
                    r"auto-renew",
                    r"shall renew unless",
                    r"will renew automatically"
                ],
                "risk_level": "high",
                "explanation": "Agreement renews without explicit consent"
            },
            "excessive_penalties": {
                "patterns": [
                    r"penalty.*\$\d+",
                    r"termination fee",
                    r"early termination.*\$\d+",
                    r"liquidated damages"
                ],
                "risk_level": "high",
                "explanation": "Substantial financial penalties for non-performance"
            },
            "one_sided_termination": {
                "patterns": [
                    r"may terminate.*at will",
                    r"can terminate.*at any time",
                    r"termination.*sole discretion"
                ],
                "risk_level": "high",
                "explanation": "One party can terminate without cause or notice"
            },
            "broad_indemnification": {
                "patterns": [
                    r"indemnify.*all.*claims",
                    r"hold harmless.*all.*liability",
                    r"indemnify.*any.*claims"
                ],
                "risk_level": "high",
                "explanation": "Broad indemnification obligations"
            },
            "confidentiality_restrictions": {
                "patterns": [
                    r"perpetual.*confidential",
                    r"confidential.*forever",
                    r"indefinite.*confidentiality"
                ],
                "risk_level": "medium",
                "explanation": "Indefinite confidentiality obligations"
            }
        }

    def analyze_clause_risk_sync(self, clauses: List[str]) -> List[Dict[str, Any]]:
        """
        Rule-based clause risk analysis (no LLM required).
        Scores each clause by scanning for high/low risk keywords.
        """
        HIGH_RISK_WORDS = [
            "unlimited", "automatic", "penalty", "forfeit", "sole discretion",
            "non-refundable", "irrevocable", "indemnify all", "hold harmless",
            "without notice", "at will", "liquidated damages",
        ]
        LOW_RISK_WORDS = ["mutual", "balanced", "fair", "reasonable", "both parties"]

        results = []
        for clause in clauses:
            lower = clause.lower()
            risk_score = 0.45  # default medium-low
            if any(w in lower for w in HIGH_RISK_WORDS):
                risk_score = 0.75
            elif any(w in lower for w in LOW_RISK_WORDS):
                risk_score = 0.25

            results.append({
                "clause": clause[:300],
                "risk_level": "High" if risk_score > 0.6 else ("Medium" if risk_score > 0.35 else "Low"),
                "risk_score": risk_score,
                "explanation": "Contains high-risk language" if risk_score > 0.6 else "Requires review",
                "affected_party": "both",
                "mitigation": "Consult legal counsel for this clause",
            })
        return results

    def detect_missing_clauses(self, document_text: str) -> List[Dict[str, Any]]:
        """
        Detect important clauses missing from document.
        
        Args:
            document_text: Full document text
            
        Returns:
            List of missing clauses
        """
        document_lower = document_text.lower()
        missing = []
        
        for clause_id, clause_info in self.STANDARD_CLAUSES.items():
            keywords = self.CLAUSE_PRESENCE_KEYWORDS.get(
                clause_id,
                [word for word in clause_info["name"].lower().split() if word not in {"clause", "nda"}],
            )
            found = any(keyword in document_lower for keyword in keywords)
            
            if not found:
                missing.append({
                    "clause_id": clause_id,
                    "clause_name": clause_info["name"],
                    "importance": clause_info["importance"],
                    "description": clause_info["description"],
                    "risk_if_missing": self._get_risk_if_missing(clause_id),
                    "recommendation": self._get_clause_recommendation(clause_id)
                })
        
        return missing

    def detect_risky_language(self, document_text: str) -> List[Dict[str, Any]]:
        """
        Detect risky language patterns in document.
        
        Args:
            document_text: Full document text
            
        Returns:
            List of detected risky phrases with locations
        """
        risky_items = []
        document_lower = document_text.lower()
        
        for risk_id, risk_info in self.RISKY_PHRASES.items():
            for pattern in risk_info.get("patterns", []):
                matches = re.finditer(pattern, document_lower, re.IGNORECASE)
                
                for match in matches:
                    # Get surrounding context
                    start = max(0, match.start() - 50)
                    end = min(len(document_text), match.end() + 50)
                    context = document_text[start:end].strip()
                    
                    risky_items.append({
                        "risk_id": risk_id,
                        "risk_type": risk_id.replace("_", " ").title(),
                        "detected_text": document_text[match.start():match.end()],
                        "context": context,
                        "risk_level": risk_info["risk_level"].title(),
                        "explanation": risk_info["explanation"],
                        "location": {
                            "start": match.start(),
                            "end": match.end()
                        }
                    })
        
        return risky_items

    def analyze_financial_risks(self, document_text: str) -> Dict[str, Any]:
        """
        Analyze financial risks in document.
        
        Args:
            document_text: Full document text
            
        Returns:
            Financial risk analysis
        """
        financial_risks = {
            "deposits": [],
            "fees": [],
            "penalties": [],
            "high_value_items": [],
            "total_financial_exposure": None,
            "risk_level": "Low"
        }

        amount_pattern = r"(?:₹|rs\.?\s*|inr\s*)\s*([0-9,]+(?:\.\d{2})?|\d+(?:,\d+)*|\d+)"
        usd_amount_pattern = r"\$\s*([0-9,]+(?:\.\d{2})?)"
        amounts = re.findall(amount_pattern, document_text, re.IGNORECASE)
        amounts.extend(re.findall(usd_amount_pattern, document_text))

        deposit_pattern = r"deposit[^\n]{0,40}?((?:₹|rs\.?\s*|inr\s*)\s*[0-9,]+(?:\.\d{2})?|\$\s*[0-9,]+(?:\.\d{2})?)"
        deposits = re.findall(deposit_pattern, document_text, re.IGNORECASE)
        if deposits:
            financial_risks["deposits"] = deposits

        fee_pattern = r"(?:fee|rent)[^\n]{0,40}?((?:₹|rs\.?\s*|inr\s*)\s*[0-9,]+(?:\.\d{2})?|\$\s*[0-9,]+(?:\.\d{2})?)"
        fees = re.findall(fee_pattern, document_text, re.IGNORECASE)
        if fees:
            financial_risks["fees"] = fees

        penalty_pattern = r"penalt(?:y|ies)[^\n]{0,40}?((?:₹|rs\.?\s*|inr\s*)\s*[0-9,]+(?:\.\d{2})?|\$\s*[0-9,]+(?:\.\d{2})?)"
        penalties = re.findall(penalty_pattern, document_text, re.IGNORECASE)
        if penalties:
            financial_risks["penalties"] = penalties

        numeric_amounts = []
        for amount in amounts:
            try:
                numeric_amounts.append(float(str(amount).replace(",", "")))
            except ValueError:
                continue

        if penalties or (numeric_amounts and max(numeric_amounts) > 50000):
            financial_risks["risk_level"] = "High"
        elif deposits or fees or numeric_amounts:
            financial_risks["risk_level"] = "Medium"
        
        return financial_risks

    def calculate_risk_score(
        self,
        clause_risks: List[Dict],
        missing_clauses: List[Dict],
        risky_language: List[Dict],
        financial_risks: Dict
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Calculate overall risk score (0-100).
        
        Args:
            clause_risks: Clause risk assessments
            missing_clauses: Missing clauses
            risky_language: Detected risky language
            financial_risks: Financial risk analysis
            
        Returns:
            Tuple of (overall_score, breakdown)
        """
        risk_scores = {
            "clause_risk": self._score_clauses(clause_risks),
            "missing_clauses": self._score_missing_clauses(missing_clauses),
            "risky_language": self._score_risky_language(risky_language),
            "financial_risk": self._score_financial_risks(financial_risks)
        }
        
        # Weighted average
        weights = {
            "clause_risk": 0.35,
            "missing_clauses": 0.30,
            "risky_language": 0.20,
            "financial_risk": 0.15
        }
        
        overall_score = sum(
            risk_scores[key] * weights[key]
            for key in risk_scores
        )
        
        # Convert to 0-100 scale
        overall_score = int(overall_score * 100)
        
        return overall_score, risk_scores

    def generate_recommendations(
        self,
        risk_analysis: Dict[str, Any],
        overall_score: int
    ) -> List[Dict[str, Any]]:
        """
        Generate recommendations based on risk analysis.
        
        Args:
            risk_analysis: Complete risk analysis
            overall_score: Overall risk score
            
        Returns:
            List of recommendations
        """
        recommendations = []
        
        # Critical recommendations for high-risk documents
        if overall_score > 70:
            recommendations.append({
                "priority": "Critical",
                "type": "General",
                "action": "Engage legal counsel immediately",
                "rationale": "High overall risk score indicates significant issues that require expert review"
            })
        
        # Address missing critical clauses
        for missing in risk_analysis.get("missing_clauses", []):
            if missing.get("importance") == "high":
                recommendations.append({
                    "priority": "High",
                    "type": "Missing Clause",
                    "action": f"Add {missing['clause_name']}",
                    "rationale": missing.get("description", "")
                })
        
        # Address high-risk language
        high_risk_items = [
            item for item in risk_analysis.get("risky_language", [])
            if str(item.get("risk_level", "")).lower() == "high"
        ]
        
        if high_risk_items:
            recommendations.append({
                "priority": "High",
                "type": "Language Review",
                "action": f"Negotiate {len(high_risk_items)} high-risk clause(s)",
                "rationale": "Found language that heavily favors one party"
            })
        
        # Financial risk recommendations
        if risk_analysis.get("financial_risks", {}).get("risk_level") == "High":
            recommendations.append({
                "priority": "High",
                "type": "Financial",
                "action": "Review financial obligations and penalties",
                "rationale": "Unusually high financial commitments detected"
            })
        
        # Compliance recommendations
        compliance_issues = len(risk_analysis.get("missing_clauses", []))
        if compliance_issues > 3:
            recommendations.append({
                "priority": "Medium",
                "type": "Compliance",
                "action": f"Address {compliance_issues} compliance gaps",
                "rationale": "Multiple missing clauses may indicate incomplete legal protections"
            })
        
        # General improvements
        if overall_score > 50:
            recommendations.append({
                "priority": "Medium",
                "type": "Review",
                "action": "Schedule legal review meeting",
                "rationale": "Moderate-to-high risk requires detailed discussion"
            })
        
        return recommendations

    def _score_clauses(self, clause_risks: List[Dict]) -> float:
        """Score clause risks on 0-1 scale."""
        if not clause_risks:
            return 0.0
        
        score = 0.0
        for clause in clause_risks:
            if "risk_score" in clause:
                score += clause["risk_score"]
        
        return score / len(clause_risks)

    def _score_missing_clauses(self, missing_clauses: List[Dict]) -> float:
        """Score missing clauses on 0-1 scale."""
        if not missing_clauses:
            return 0.0
        
        score = 0.0
        for clause in missing_clauses:
            if clause.get("importance") == "high":
                score += 0.1
            elif clause.get("importance") == "medium":
                score += 0.05
        
        return min(score, 1.0)

    def _score_risky_language(self, risky_language: List[Dict]) -> float:
        """Score risky language on 0-1 scale."""
        if not risky_language:
            return 0.0
        
        high_risk_count = sum(
            1 for item in risky_language
            if str(item.get("risk_level", "")).lower() == "high"
        )
        medium_risk_count = sum(
            1 for item in risky_language
            if str(item.get("risk_level", "")).lower() == "medium"
        )
        
        score = (high_risk_count * 0.08) + (medium_risk_count * 0.03)
        return min(score, 1.0)

    def _score_financial_risks(self, financial_risks: Dict) -> float:
        """Score financial risks on 0-1 scale."""
        if financial_risks.get("risk_level") == "High":
            return 0.8
        elif financial_risks.get("risk_level") == "Medium":
            return 0.4
        return 0.1

    def _get_risk_if_missing(self, clause_id: str) -> str:
        """Get risk explanation for missing clause."""
        risks = {
            "termination": "Difficult to exit the agreement or terminate relationship",
            "confidentiality": "Sensitive business information could be disclosed",
            "liability": "Unlimited liability exposure for breaches",
            "dispute_resolution": "Disputes could be costly and unpredictable",
            "force_majeure": "Performance obligations may be unenforceable in emergencies",
            "payment_terms": "Unclear payment obligations could lead to disputes",
            "renewal": "Agreement could auto-renew without clear terms",
            "indemnification": "Unclear who bears responsibility for damages"
        }
        return risks.get(clause_id, "Legal protection gap identified")

    def _get_clause_recommendation(self, clause_id: str) -> str:
        """Get specific recommendation for missing clause."""
        recommendations = {
            "termination": "Add clear termination conditions, notice periods, and wind-down procedures",
            "confidentiality": "Include confidentiality obligations, exceptions, and duration limits",
            "liability": "Define liability caps, remedies, and exclusions",
            "dispute_resolution": "Specify mediation/arbitration procedures and governing law",
            "force_majeure": "Define triggering events and performance suspension procedures",
            "payment_terms": "Clarify payment amounts, schedule, method, and late payment penalties",
            "renewal": "Specify renewal conditions, notice requirements, and opt-out procedures",
            "indemnification": "Define indemnification triggers, scope, and limitations"
        }
        return recommendations.get(clause_id, "Consult legal counsel to add this clause")
