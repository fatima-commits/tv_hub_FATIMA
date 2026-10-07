import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

type ReportEmailData = {
  reason: string;
  description: string;
  status: string;
  createdAt: Date;
  evidenceUrls: string[];
};

let transporterPromise: Promise<Transporter> | undefined;
let usesEthereal = false;

async function getTransporter(): Promise<Transporter> {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (env.nodeEnv === 'test') {
      return nodemailer.createTransport({ jsonTransport: true });
    }

    if (env.smtpHost) {
      usesEthereal = false;
      return nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        auth: env.smtpUser && env.smtpPass ? { user: env.smtpUser, pass: env.smtpPass } : undefined
      });
    }

    usesEthereal = true;
    const account = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: account.user, pass: account.pass }
    });
  })();

  return transporterPromise;
}

async function sendWithTransporter(message: SendMailOptions): Promise<void> {
  const transporter = await getTransporter();
  const info = await transporter.sendMail(message);

  if (usesEthereal) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) console.log(`Email preview: ${previewUrl}`);
  }
}

  // TODO V6 MAIL 1
export async function sendReportCreatedEmail(report: ReportEmailData, channelName: string): Promise<void> {
  const evidence = report.evidenceUrls.length
    ? `\nEvidencias:\n${report.evidenceUrls.join('\n')}`
    : '';

  await sendWithTransporter({
    from: env.smtpFrom,
    to: env.reportNotificationEmail,
    subject: `[TV Hub] Nuevo reporte en el canal ${channelName}: ${report.reason}`,
    text: [
      'Se ha creado un nuevo reporte.',
      '',
      `Canal: ${channelName}`,
      `Razón: ${report.reason}`,
      `Descripción: ${report.description}`,
      `Estado: ${report.status}`,
      `Fecha de creación: ${report.createdAt.toISOString()}`,
      evidence
    ].join('\n')
  });
}

// TODO V6 MAIL 2
export async function sendReportResolvedEmail(report: ReportEmailData, channelName: string, recipient: string): Promise<void> {
  await sendWithTransporter({
    from: env.smtpFrom,
    to: recipient,
    subject: `[TV Hub] Tu reporte fue resuelto: ${report.reason}`,
    text: [
      'Tu reporte ha sido resuelto por el equipo de soporte.',
      '',
      `Canal: ${channelName}`,
      `Razón: ${report.reason}`,
      `Descripción: ${report.description}`,
      `Estado final: ${report.status}`,
      `Reporte creado el: ${report.createdAt.toISOString()}`
    ].join('\n')
  });
}
