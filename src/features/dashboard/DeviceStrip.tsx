import { Badge, Panel } from "@/components/ui";
import { usePlatform } from "@/hooks/usePlatform";
import { facilityName } from "@/lib/derive";
import { deviceStatusLabel, deviceTypeLabel, sourceLabel } from "@/lib/labels";
import { formatDateTime } from "@/utils/format";

export function DeviceStrip() {
  const { data } = usePlatform();
  return (
    <Panel id="devices" title="الأجهزة والدرون" action={<Badge tone="sim">القياس محاكى — ليس بثًا حيًا</Badge>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="text-muted">
            <tr>
              <th className="p-2 text-start">المعرف</th>
              <th className="p-2 text-start">النوع</th>
              <th className="p-2 text-start">الحالة</th>
              <th className="p-2 text-start">المنشأة</th>
              <th className="p-2 text-start">آخر اتصال</th>
              <th className="p-2 text-start">البطارية</th>
              <th className="p-2 text-start">الموقع</th>
              <th className="p-2 text-start">الحرارة</th>
              <th className="p-2 text-start">الارتفاع</th>
              <th className="p-2 text-start">السرعة</th>
              <th className="p-2 text-start">المصدر</th>
            </tr>
          </thead>
          <tbody>
            {data.devices.map((device) => (
              <tr key={device.id} className="border-t border-line">
                <td className="p-2 mono">{device.code}<div className="text-xs text-muted">{device.name}</div></td>
                <td className="p-2">{deviceTypeLabel[device.device_type]}</td>
                <td className="p-2">{deviceStatusLabel[device.status]}</td>
                <td className="p-2">{facilityName(data, device.facility_id)}</td>
                <td className="p-2">{formatDateTime(device.last_communication_at)}</td>
                <td className="p-2 mono">{device.battery_percent == null ? "—" : `${device.battery_percent}%`}</td>
                <td className="p-2 mono">{device.latitude == null ? "—" : `${device.latitude.toFixed(4)}, ${device.longitude?.toFixed(4)}`}</td>
                <td className="p-2 mono">{device.temperature_c == null ? "—" : `${device.temperature_c}°C`}</td>
                <td className="p-2 mono">{device.altitude_m == null ? "—" : `${device.altitude_m} m`}</td>
                <td className="p-2 mono">{device.speed_mps == null ? "—" : `${device.speed_mps} m/s`}</td>
                <td className="p-2"><Badge tone={device.source === "UNAVAILABLE" ? "crit" : device.source === "SIMULATION" ? "sim" : "info"}>{sourceLabel[device.source]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">المصدر LIVE لا يُستخدم في هذا العرض. الكاميرا غير المتاحة تبقى بلا قراءة بدل اختلاق بث.</p>
    </Panel>
  );
}
