

import Attendance from './Attendance';

import DailyAttendance, {
  type AttendanceOpportunity,
} from './DailyAttendance';

export default function AttendanceManager({
  opportunities,
  selectedProgrammeId,
}: {
  opportunities: AttendanceOpportunity[];
  selectedProgrammeId: string;
}) {
  const opportunityId = selectedProgrammeId;

  const opportunity = opportunities.find(
    item => String(item.id) === opportunityId
  );

  const mode =
    opportunity?.attendance_mode ?? 'legacy';

  const modeLabels = {
    legacy: 'Duty & Shift Based',
    simple: 'Simple Attendance',
    detailed: 'Detailed Attendance',
    none: 'No Attendance Tracking',
  };

  return (
    <section>
      <div className="panel">
        <h2>Volunteer Attendance</h2>

        <div
          style={{
            padding: '12px 16px',
            border: '1px solid #e7d9be',
            background: '#FFFDF8',
            borderRadius: 10,
          }}
        >
          <small>Selected Seva Programme</small>
          <div style={{
            color: '#6B1720',
            fontWeight: 700,
            marginTop: 5,
          }}>
            {opportunity?.title ||
              'Choose a programme from the workspace above.'}
          </div>
        </div>

        {opportunity && (
          <p>
            Attendance mode: <strong>{modeLabels[mode]}</strong>
          </p>
        )}
      </div>

      {opportunity && (
        <>
          {mode === 'legacy' && (
            <Attendance
              key={opportunity.id}
              opportunities={[opportunity]}
              selectedProgrammeId={opportunityId}
            />
          )}

          {(mode === 'simple' || mode === 'detailed') && (
            <DailyAttendance
              key={opportunity.id}
              opportunity={opportunity}
            />
          )}

          {mode === 'none' && (
            <div className="panel">
              <h3>Attendance Tracking Disabled</h3>

              <p>
                This programme does not require attendance
                records.
              </p>

              <p>
                After the selected service dates are finished,
                verify each volunteer's participation manually
                using the Service Completion section.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}