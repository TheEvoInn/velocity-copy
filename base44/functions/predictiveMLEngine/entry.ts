import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    if (action === 'score_opportunity') {
      const { opportunity_id } = await req.json();

      const opportunity = await base44.entities.Opportunity.filter({
        id: opportunity_id
      }).then(r => r[0]);

      if (!opportunity) {
        return Response.json({ error: 'Opportunity not found' }, { status: 404 });
      }

      // Scoring factors
      let successScore = 50; // Base 50%

      // Factor 1: Velocity (time to first dollar)
      if (opportunity.velocity_score) {
        successScore += (opportunity.velocity_score * 0.15); // 15% weight
      }

      // Factor 2: Risk inversely affects success
      if (opportunity.risk_score) {
        successScore -= (opportunity.risk_score * 0.10); // -10% weight
      }

      // Factor 3: Category success rates
      const categoryRates = {
        arbitrage: 0.72,
        service: 0.65,
        lead_gen: 0.58,
        digital_flip: 0.75,
        auction: 0.63,
        market_inefficiency: 0.70,
        trend_surge: 0.55,
        freelance: 0.68,
        resale: 0.62,
        grant: 0.45,
        contest: 0.35,
        giveaway: 0.40
      };

      const categoryRate = categoryRates[opportunity.category] || 0.50;
      successScore += (categoryRate * 20); // Category adds 0-20 points

      // Factor 4: Time sensitivity (urgent = higher chance)
      const timeSensitivityBoost = {
        immediate: 0.15,
        hours: 0.12,
        days: 0.08,
        weeks: 0.03,
        ongoing: 0.05
      };

      successScore += (timeSensitivityBoost[opportunity.time_sensitivity] || 0) * 10;

      // Clamp to 0-100
      successScore = Math.max(0, Math.min(100, successScore));

      // ROI prediction
      let roiPrediction = 0;
      if (opportunity.profit_estimate_low && opportunity.profit_estimate_high) {
        const avgProfit = (opportunity.profit_estimate_low + opportunity.profit_estimate_high) / 2;
        const capital = opportunity.capital_required || 1;
        roiPrediction = (avgProfit / capital) * 100;
      }

      // Time to payout estimate (days)
      const timeToPayoutMap = {
        immediate: 1,
        hours: 0.5,
        days: 3,
        weeks: 14,
        ongoing: 30
      };

      const estTimeToFirstDollar = timeToPayoutMap[opportunity.time_sensitivity] || 7;

      return Response.json({
        success: true,
        opportunity_id,
        success_probability: Math.round(successScore),
        roi_estimate: Math.round(roiPrediction),
        est_days_to_first_dollar: estTimeToFirstDollar,
        confidence: 'medium',
        recommendation: successScore > 70 ? 'high_priority' : successScore > 50 ? 'medium_priority' : 'low_priority'
      });
    }

    if (action === 'detect_behavioral_anomalies') {
      const userGoals = await base44.entities.UserGoals.filter({
        created_by: user.email
      }).then(r => r[0]);

      if (!userGoals) {
        return Response.json({ success: true, anomalies: [] });
      }

      const transactions = await base44.entities.Transaction.filter({
        created_by: user.email,
        created_date: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() }
      });

      const anomalies = [];

      // Churn risk: low activity in last 30 days
      const last30Days = transactions.filter(t =>
        new Date(t.created_date).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
      );

      const churnRisk = last30Days.length === 0 ? 'high' : last30Days.length < 5 ? 'medium' : 'low';
      if (churnRisk !== 'low') {
        anomalies.push({
          type: 'churn_risk',
          severity: churnRisk === 'high' ? 'critical' : 'medium',
          details: `Only ${last30Days.length} transactions in last 30 days`,
          recommendation: churnRisk === 'high' ? 'Engage user immediately' : 'Monitor for engagement'
        });
      }

      // Fraud pattern: sudden spike in earnings
      const avgMonthlyEarnings = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.net_amount || t.amount), 0) / Math.max(Math.ceil(transactions.length / 30), 1);

      const last30Earnings = last30Days
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.net_amount || t.amount), 0);

      if (last30Earnings > avgMonthlyEarnings * 3) {
        anomalies.push({
          type: 'earnings_spike',
          severity: 'medium',
          details: `Earnings ${((last30Earnings / avgMonthlyEarnings) * 100).toFixed(0)}% above average`,
          recommendation: 'Verify legitimacy of spike; watch for unsustainable patterns'
        });
      }

      // Fraud pattern: multiple failed attempts
      const failedCount = transactions.filter(t => t.payout_status === 'failed').length;
      if (failedCount > 3) {
        anomalies.push({
          type: 'repeated_failures',
          severity: 'high',
          details: `${failedCount} failed transactions detected`,
          recommendation: 'Review account credentials and payout methods'
        });
      }

      // Success rate tracking
      const totalOpportunities = await base44.entities.Opportunity.filter({
        created_by: user.email
      });

      const completedOps = totalOpportunities.filter(o => 
        o.status === 'completed' || o.status === 'submitted'
      );

      const successRate = completedOps.length / Math.max(totalOpportunities.length, 1);
      if (successRate < 0.30) {
        anomalies.push({
          type: 'low_success_rate',
          severity: 'medium',
          details: `${(successRate * 100).toFixed(1)}% success rate`,
          recommendation: 'Review opportunity selection strategy; focus on higher-confidence opportunities'
        });
      }

      return Response.json({ success: true, anomalies_found: anomalies.length, anomalies });
    }

    if (action === 'recommend_opportunities') {
      const userGoals = await base44.entities.UserGoals.filter({
        created_by: user.email
      }).then(r => r[0]);

      if (!userGoals) {
        return Response.json({ error: 'User goals not found' }, { status: 404 });
      }

      const { limit = 10 } = await req.json();
      const userSkills = userGoals.skills || [];
      const userCategories = userGoals.preferred_categories || [];

      // Get all opportunities
      const allOpportunities = await base44.entities.Opportunity.filter({
        status: { $in: ['new', 'reviewing'] }
      }, '-overall_score', limit * 2);

      // Score each opportunity for this user
      const scoredOpps = [];

      for (const opp of allOpportunities) {
        let matchScore = 50; // Base match score

        // Skill match
        if (opp.required_documents && userSkills.length > 0) {
          const skillMatches = userSkills.filter(skill =>
            opp.required_documents.some(doc => doc.toLowerCase().includes(skill.toLowerCase()))
          ).length;
          matchScore += (skillMatches / Math.max(opp.required_documents.length, 1)) * 25;
        }

        // Category preference match
        if (userCategories.includes(opp.category)) {
          matchScore += 15;
        }

        // Capital requirement match
        if (opp.capital_required && userGoals.available_capital) {
          if (opp.capital_required <= userGoals.available_capital * 0.3) {
            matchScore += 10; // Safe capital requirement
          } else if (opp.capital_required <= userGoals.available_capital) {
            matchScore += 5; // Possible but risky
          }
        }

        // ROI vs daily target
        if (opp.profit_estimate_low && opp.profit_estimate_high && userGoals.daily_target) {
          const avgProfit = (opp.profit_estimate_low + opp.profit_estimate_high) / 2;
          if (avgProfit >= userGoals.daily_target * 2) {
            matchScore += 10; // High-value opportunity
          }
        }

        // Time sensitivity match (urgent = higher priority)
        if (opp.time_sensitivity === 'immediate' || opp.time_sensitivity === 'hours') {
          matchScore += 8;
        }

        // Risk tolerance
        if (opp.risk_score && userGoals.risk_tolerance) {
          const riskTolerance = {
            conservative: 30,
            moderate: 60,
            aggressive: 100
          };

          const threshold = riskTolerance[userGoals.risk_tolerance];
          if (opp.risk_score <= threshold) {
            matchScore += 5;
          }
        }

        scoredOpps.push({
          ...opp,
          user_match_score: Math.min(100, matchScore),
          recommendation_reason: matchScore > 80 ? 'excellent_fit' : matchScore > 60 ? 'good_fit' : 'fair_fit'
        });
      }

      // Sort by match score and return top
      const recommendations = scoredOpps
        .sort((a, b) => b.user_match_score - a.user_match_score)
        .slice(0, limit);

      return Response.json({
        success: true,
        recommendations: recommendations.map(r => ({
          opportunity_id: r.id,
          title: r.title,
          category: r.category,
          profit_estimate: `$${r.profit_estimate_low || 0}-$${r.profit_estimate_high || 0}`,
          capital_required: r.capital_required,
          user_match_score: r.user_match_score,
          recommendation_reason: r.recommendation_reason
        }))
      });
    }

    if (action === 'generate_ml_report') {
      const opportunities = await base44.entities.Opportunity.filter({
        created_by: user.email
      });

      // Score all opportunities
      const scoredOpps = [];
      for (const opp of opportunities.slice(0, 50)) {
        const scoreRes = await base44.functions.invoke('predictiveMLEngine', {
          action: 'score_opportunity',
          opportunity_id: opp.id
        });
        scoredOpps.push({ ...opp, ...scoreRes.data });
      }

      // Get behavioral anomalies
      const anomRes = await base44.functions.invoke('predictiveMLEngine', {
        action: 'detect_behavioral_anomalies'
      });

      // Get recommendations
      const recRes = await base44.functions.invoke('predictiveMLEngine', {
        action: 'recommend_opportunities',
        limit: 5
      });

      // Calculate aggregate metrics
      const avgSuccessProbability = scoredOpps.reduce((sum, o) => sum + (o.success_probability || 0), 0) / Math.max(scoredOpps.length, 1);
      const highPriorityOps = scoredOpps.filter(o => o.recommendation === 'high_priority').length;
      const avgROI = scoredOpps.reduce((sum, o) => sum + (o.roi_estimate || 0), 0) / Math.max(scoredOpps.length, 1);

      return Response.json({
        success: true,
        timestamp: new Date().toISOString(),
        summary: {
          total_opportunities_analyzed: scoredOpps.length,
          avg_success_probability: Math.round(avgSuccessProbability),
          high_priority_count: highPriorityOps,
          avg_roi_estimate: Math.round(avgROI),
          behavioral_anomalies_detected: anomRes.data.anomalies_found
        },
        top_opportunities: scoredOpps.slice(0, 5),
        anomalies: anomRes.data.anomalies,
        recommendations: recRes.data.recommendations
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Predictive ML engine error:', error);
    return Response.json(
      { error: error.message || 'ML prediction failed' },
      { status: 500 }
    );
  }
});