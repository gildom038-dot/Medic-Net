function classifyVitals(values) {
  const pulse = Number(values.pulse);
  const respiration = Number(values.respiratoryRate);
  const temperature = Number(values.temperature);
  const oxygen = Number(values.oxygenSaturation);
  const systolic = Number(String(values.bloodPressure || "").split("/")[0]);
  if (pulse > 120 || oxygen < 90 || respiration > 25 || temperature >= 40 || systolic < 90 || systolic > 200) return "Kritisch";
  if (pulse > 100 || pulse < 50 || oxygen < 95 || respiration > 20 || temperature >= 38 || systolic < 100) return "Warnung";
  return "Normal";
}

module.exports = { classifyVitals };
