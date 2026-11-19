import PDFDocument from 'pdfkit';
import { Response } from 'express';

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

const COLORS = {
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

export function generateVolunteerCertificate(
  certificate: CertificateData,
  res: Response,
  preview = false
) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
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

  const filename =
    `${certificate.certificate_number}.pdf`;

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
    console.error('Certificate PDF error:', error);
    res.destroy(error);
  });

  doc.pipe(res);

  // ========================================
  // BACKGROUND
  // ========================================

  doc.rect(0, 0, width, height)
    .fill(COLORS.ivory);

  // ========================================
  // OUTER BORDER
  // ========================================

  doc.rect(
    18,
    18,
    width - 36,
    height - 36
  )
    .lineWidth(3)
    .stroke(COLORS.maroon);

  doc.rect(
    27,
    27,
    width - 54,
    height - 54
  )
    .lineWidth(1.5)
    .stroke(COLORS.gold);

  doc.rect(
    33,
    33,
    width - 66,
    height - 66
  )
    .lineWidth(0.5)
    .stroke(COLORS.gold);

  // ========================================
  // DECORATIVE CORNERS
  // ========================================

  const corners = [
    [45, 45],
    [width - 45, 45],
    [45, height - 45],
    [width - 45, height - 45],
  ];

  for (const [x, y] of corners) {
    doc.circle(x, y, 5)
      .fill(COLORS.gold);
  }

  // ========================================
  // TEMPLE HEADER
  // ========================================

  doc.font('Times-Bold')
    .fontSize(18)
    .fillColor(COLORS.maroon)
    .text(
      'DIVYAKSHETRA HARIHARAPURA',
      60,
      55,
      {
        width: width - 120,
        align: 'center',
        lineBreak: false,
      }
    );

  doc.font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.darkGold)
    .text(
      'VOLUNTEER SEVA',
      60,
      83,
      {
        width: width - 120,
        align: 'center',
        characterSpacing: 3,
      }
    );

  doc.moveTo(220, 105)
    .lineTo(width - 220, 105)
    .lineWidth(1)
    .stroke(COLORS.gold);

  // ========================================
  // CERTIFICATE TITLE
  // ========================================

  doc.font('Times-Bold')
    .fontSize(30)
    .fillColor(COLORS.maroon)
    .text(
      certificate.certificate_title,
      60,
      122,
      {
        width: width - 120,
        height: 40,
        align: 'center',
        ellipsis: true,
      }
    );

  doc.font('Helvetica')
    .fontSize(12)
    .fillColor(COLORS.muted)
    .text(
      'This certificate is proudly presented to',
      60,
      170,
      {
        width: width - 120,
        align: 'center',
      }
    );

  // ========================================
  // VOLUNTEER NAME
  // ========================================

  doc.font('Times-BoldItalic')
    .fontSize(32);

  while (
    doc.widthOfString(
      certificate.volunteer_name
    ) > width - 150 &&
    doc.currentLineHeight() > 20
  ) {
    const currentSize =
      doc.currentLineHeight() / 1.15;

    doc.fontSize(currentSize - 1);
  }

  doc.fillColor(COLORS.darkGold)
    .text(
      certificate.volunteer_name,
      75,
      195,
      {
        width: width - 150,
        height: 48,
        align: 'center',
        ellipsis: true,
      }
    );

  doc.moveTo(180, 248)
    .lineTo(width - 180, 248)
    .lineWidth(0.7)
    .stroke(COLORS.gold);

  // ========================================
  // CERTIFICATE MESSAGE
  // ========================================

  const message =
    certificate.certificate_message ||
    `In recognition of dedicated voluntary service and valuable contribution towards ${certificate.programme_name} at Divyakshetra Hariharapura.`;

  doc.font('Helvetica')
    .fontSize(12)
    .fillColor(COLORS.text)
    .text(
      message,
      100,
      266,
      {
        width: width - 200,
        height: 64,
        align: 'center',
        lineGap: 4,
        ellipsis: true,
      }
    );

  // ========================================
  // SERVICE DETAILS
  // ========================================

  const attendanceMode =
    certificate.attendance_mode ?? 'legacy';
  if (
    attendanceMode !== 'none' &&
    certificate.service_start_date &&
    certificate.service_end_date
  ) {
    const startDate = formatDate(
      certificate.service_start_date
    );
    const endDate = formatDate(
      certificate.service_end_date
    );
    doc.font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLORS.maroon)
      .text(
        `Service period: ${startDate} - ${endDate}`,
        60,
        342,
        {
          width: width - 120,
          align: 'center',
        }
      );
  }
  const serviceDetails: string[] = [];
  if (
    attendanceMode !== 'none' &&
    certificate.total_service_days != null
  ) {
    serviceDetails.push(
      `Service days: ${certificate.total_service_days}`
    );
  }
  if (
    ['legacy', 'detailed'].includes(attendanceMode) &&
    certificate.total_service_hours != null
  ) {
    const hours = Number(
      certificate.total_service_hours
    );
    if (Number.isFinite(hours) && hours >= 0) {
      const label =
        attendanceMode === 'detailed'
          ? 'Actual service hours'
          : 'Scheduled hours attended';
      serviceDetails.push(
        `${label}: ${hours}`
      );
    }
  }
  if (serviceDetails.length > 0) {
    doc.font('Helvetica')
      .fontSize(12)
      .fillColor(COLORS.text)
      .text(
        serviceDetails.join('     |     '),
        60,
        366,
        {
          width: width - 120,
          align: 'center',
        }
      );
  }
  // ========================================
  // SIGNATORY
  // ========================================

  doc.moveTo(
    width / 2 - 120,
    435
  )
    .lineTo(
      width / 2 + 120,
      435
    )
    .lineWidth(0.8)
    .stroke(COLORS.gold);

  doc.font('Times-Bold')
    .fontSize(14)
    .fillColor(COLORS.maroon)
    .text(
      certificate.signatory_name ||
        'Authorized Signatory',
      100,
      445,
      {
        width: width - 200,
        height: 20,
        align: 'center',
        ellipsis: true,
      }
    );

  doc.font('Helvetica')
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(
      certificate.signatory_designation ||
        'Temple Administration',
      100,
      467,
      {
        width: width - 200,
        height: 20,
        align: 'center',
        ellipsis: true,
      }
    );

  // ========================================
  // CERTIFICATE NUMBER AND ISSUED DATE
  // ========================================

  doc.font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(
      `Certificate No: ${certificate.certificate_number}`,
      50,
      height - 82,
      {
        width: width - 100,
        align: 'center',
      }
    );

  if (certificate.issued_at) {
    doc.text(
      `Issued on: ${formatDate(certificate.issued_at)}`,
      50,
      height - 65,
      {
        width: width - 100,
        align: 'center',
      }
    );
  }

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
}