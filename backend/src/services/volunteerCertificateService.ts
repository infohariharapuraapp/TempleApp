import PDFDocument from 'pdfkit';
import { Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

interface CertificateData {
  certificate_number: string;
  volunteer_name: string;
  programme_name: string;
  certificate_title: string;
  certificate_message: string | null;
  attendance_mode?:
    | 'legacy'
    | 'simple'
    | 'detailed'
    | 'none';
  service_start_date: string | null;
  service_end_date: string | null;
  total_service_days: number | null;
  total_service_hours: number | string | null;
  signatory_name: string | null;
  signatory_designation: string | null;
  issued_at: string | Date | null;
  status: string;
}

const TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../assets/certificates/volunteer-certificate-template.png'
);
const CERTIFICATE_WIDTH = 900;
const CERTIFICATE_HEIGHT = 600;const COLORS = {
  maroon: '#6B1720',
  gold: '#C69A3A',
  darkGold: '#947023',
  ivory: '#FFFDF5',
  text: '#40372D',
  muted: '#736B60',
};

function formatDate(value: string | Date) {
  const date = new Date(value);

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

let cachedCertificateTemplate: Buffer | undefined;
function getCertificateTemplate(): Buffer {
  if (!cachedCertificateTemplate) {
    cachedCertificateTemplate = fs.readFileSync(TEMPLATE_PATH);
  }
  return cachedCertificateTemplate;
}
export function generateVolunteerCertificate(
  certificate: CertificateData,
  res: Response,
  preview = false
) {
  const template = getCertificateTemplate();

  const doc = new PDFDocument({
    size: [CERTIFICATE_WIDTH, CERTIFICATE_HEIGHT],
    margin: 0,
    autoFirstPage: true,

    info: {
      Title: certificate.certificate_title,
      Author: 'Divyakshetra Hariharapura',
      Subject: 'Volunteer Seva Certificate',
    },
  });

  const width = doc.page.width;
  const height = doc.page.height;

  const safeCertificateNumber =
    String(certificate.certificate_number ?? '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 100) || 'volunteer-certificate';
  const filename = `${safeCertificateNumber}.pdf`;

  res.setHeader(
    'Content-Type',
    'application/pdf'
  );

  res.setHeader(
    'Content-Disposition',
    `${preview ? 'inline' : 'attachment'}; filename="${filename}"`
  );

  res.setHeader(
    'Cache-Control',
    'private, no-store'
  );

  doc.on('error', error => {
    console.error('Certificate PDF stream failed');
    if (!res.destroyed) {
      res.destroy(error);
    }
  });
  doc.pipe(res);
  try {

  // ========================================
  // BACKGROUND
  // ========================================

  doc.image(template, 0, 0, {
    width,
    height,
  });

  // ========================================
  // ========================================
  // GOLDEN CERTIFICATE DYNAMIC DETAILS
  // ========================================
  // The template image already contains the
  // original portraits, temple artwork, headings,
  // blessings, decorations and printed labels.
  const scaleX = width / 1536;
  const scaleY = height / 1024;
  const sx = (value: number) => value * scaleX;
  const sy = (value: number) => value * scaleY;
  const cleanText = (value: unknown, maxLength = 200) =>
    typeof value === 'string'
      ? value.replace(/[\u0000-\u001F\u007F]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, maxLength)
      : '';
  const drawField = (
    value: string,
    px: number,
    py: number,
    pw: number,
    ph: number,
    fontSize: number,
    font: string = 'Helvetica-Bold'
  ) => {
    if (!value) return;
    doc.font(font);
    let size = fontSize;
    while (
      size > 6 &&
      doc.fontSize(size).widthOfString(value) > sx(pw)
    ) {
      size -= 0.5;
    }
    doc.fontSize(size)
      .fillColor(COLORS.maroon)
      .text(value, sx(px), sy(py), {
        width: sx(pw),
        height: sy(ph),
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });
  };
  // ADMIN DYNAMIC CERTIFICATE MESSAGE
  const defaultMessage =
    'In sincere appreciation of your dedicated service, valuable time ' +
    'and selfless contribution as a Volunteer (Sevaka) at ' +
    'Divyakshetra Hariharapura. Your commitment to Dharma, Seva ' +
    'and the Temple activities is deeply valued and greatly appreciated.';
  const message =
    cleanText(certificate.certificate_message, 400) ||
    defaultMessage;
  doc.font('Times-BoldItalic')
    .fontSize(13)
    .fillColor(COLORS.maroon)
    .text(message, sx(445), sy(565), {
      width: sx(650),
      height: sy(125),
      align: 'center',
      ellipsis: true
    });  // Volunteer name
  drawField(
    cleanText(certificate.volunteer_name),
    445, 492, 650, 48, 26,
    'Times-BoldItalic'
  );
  // Service period
  const attendanceEnabled =
    certificate.attendance_mode !== 'none';
  const startDate =
    attendanceEnabled && certificate.service_start_date
      ? formatDate(certificate.service_start_date)
      : '';
  const endDate =
    attendanceEnabled && certificate.service_end_date
      ? formatDate(certificate.service_end_date)
      : '';
  const servicePeriod =
    startDate && endDate
      ? startDate === endDate
        ? startDate
        : `${startDate} - ${endDate}`
      : startDate || endDate;
  // Service period: fixed safe area after the printed label.
  // Supports both a single date and a two-date range.
  const periodX = sx(535);
  const periodY = sy(719);
  const periodWidth = sx(345);
  const periodHeight = sy(28);
  if (servicePeriod) {
    doc.save();
    doc.font('Helvetica-Bold');
    const availableWidth = periodWidth - sx(8);
    let periodFontSize = 10.5;
    while (
      periodFontSize > 7 &&
      doc.fontSize(periodFontSize).widthOfString(servicePeriod) > availableWidth
    ) {
      periodFontSize -= 0.5;
    }
    doc.fontSize(periodFontSize)
      .fillColor(COLORS.maroon)
      .text(servicePeriod, periodX, periodY, {
        width: periodWidth,
        height: periodHeight,
        align: 'left',
        lineBreak: false,
        ellipsis: true
      });
    doc.restore();
  }
  // Total service days
  const serviceDays =
    attendanceEnabled &&
    certificate.total_service_days != null &&
    Number.isFinite(Number(certificate.total_service_days))
      ? String(certificate.total_service_days)
      : '';
  drawField(
    serviceDays,
    1110, 718, 110, 30, 12
  );
  // Certificate number
  drawField(
    cleanText(certificate.certificate_number, 150),
    277, 816, 190, 38, 9
  );
  // Issue date
  if (certificate.issued_at) {
    drawField(
      formatDate(certificate.issued_at),
      241, 878, 220, 30, 10
    );
  }
  // Signatory details above the existing signature line.
  // The original background and printed labels remain unchanged.
  drawField(
    cleanText(certificate.signatory_name, 120),
    1120, 800, 320, 26, 11,
    'Times-Bold'
  );
  drawField(
    cleanText(certificate.signatory_designation, 120),
    1120, 831, 320, 24, 8
  );
  // ========================================
  // DRAFT / REVOKED WATERMARK
  // ========================================

  if (
    preview ||
    certificate.status !== 'issued'
  ) {
    doc.save();

    doc.rotate(-25, {
      origin: [
        width / 2,
        height / 2,
      ],
    });

    doc.opacity(0.12)
      .font('Helvetica-Bold')
      .fontSize(80)
      .fillColor(COLORS.maroon)
      .text(
        certificate.status === 'revoked'
          ? 'REVOKED'
          : certificate.status === 'issued'
            ? 'PREVIEW'
            : 'DRAFT',
        0,
        height / 2 - 40,
        {
          width,
          align: 'center',
        }
      );

    doc.restore();
  }

    doc.end();
  } catch (error) {
    console.error('Certificate PDF rendering failed');
    const failure =
      error instanceof Error
        ? error
        : new Error('Certificate PDF rendering failed');
    doc.destroy();
    if (res.headersSent && !res.destroyed) {
      res.destroy();
    }
    throw failure;
  }
}