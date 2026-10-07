import cron from 'node-cron';
import { env } from '../config/env.js';
import { Report } from '../models/report.model.js';
import { emitReportUpdated } from '../realtime/socket.js';

// TODO QUE IMPLEMENTE YO
export async function escalateOldReports(): Promise<number> {
  const cutoff = new Date(Date.now() - env.reportEscalationMinutes * 60_000);

  const reports = await Report.find({
    status: "OPEN",
    createdAt: { $lte: cutoff },
  });

  for (const report of reports) {
    report.status = "ESCALATED";
    await report.save();
    emitReportUpdated(String(report.userId), report);
  }

  return reports.length;
}

// TODO QUE IMPLEMENTE YO
export function startReportEscalationJob(): void {
  cron.schedule(env.reportEscalationCron, async () => {
    try {
      await escalateOldReports();
    } catch (error) {
      console.error("Report escalation job failed:", error);
    }
  });
}
