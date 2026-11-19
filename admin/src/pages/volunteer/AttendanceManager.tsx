import { useState } from 'react';

import Attendance from './Attendance';

import DailyAttendance, {
  type AttendanceOpportunity,
} from './DailyAttendance';

export default function AttendanceManager({
  opportunities,
}: {
  opportunities: AttendanceOpportunity[];
}) {
  const [opportunityId, setOpportunityId] =
    useState('');

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

        <label>
          Select Programme

          <select
            value={opportunityId}
            onChange={event => {
              if (
                opportunityId &&
                !window.confirm(
                  'Switch programme? Save any pending changes first.'
                )
              ) {
                return;
              }

              setOpportunityId(event.target.value);
            }}
          >
            <option value="">
              Select a programme
            </option>

            {opportunities.map(item => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>

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