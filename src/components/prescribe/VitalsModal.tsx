'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Heart, Activity, Weight, Ruler, Thermometer, Droplets, Plus, RefreshCw, ArrowUpDown } from 'lucide-react'

export interface VitalsData {
  pulse: number
  bp_systolic: number
  bp_diastolic: number
  weight: number
  height_ft: number
  height_in: number
  height_cm: number
  bmi: number
  spo2: number
  temp: number
}

const defaultVitals: VitalsData = {
  pulse: 0,
  bp_systolic: 0,
  bp_diastolic: 0,
  weight: 0,
  height_ft: 0,
  height_in: 0,
  height_cm: 0,
  bmi: 0,
  spo2: 0,
  temp: 0,
}

interface VitalsModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (vitals: VitalsData) => void
  initialVitals?: Partial<VitalsData>
  patientName?: string
}

export default function VitalsModal({ isOpen, onClose, onSave, initialVitals, patientName }: VitalsModalProps) {
  const [vitals, setVitals] = useState<VitalsData>({ ...defaultVitals, ...initialVitals })
  const [heightMode, setHeightMode] = useState<'ftin' | 'cm'>('cm')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setVitals({ ...defaultVitals, ...initialVitals })
    }
  }, [isOpen, initialVitals])

  const calculatedBMI = useMemo(() => {
    const w = vitals.weight
    if (!w || w <= 0) return 0

    let hCm = vitals.height_cm
    if (heightMode === 'ftin') {
      hCm = (vitals.height_ft * 30.48) + (vitals.height_in * 2.54)
    }

    if (!hCm || hCm <= 0) return 0

    const hM = hCm / 100
    const bmi = w / (hM * hM)
    return Math.round(bmi * 10) / 10
  }, [vitals.weight, vitals.height_cm, vitals.height_ft, vitals.height_in, heightMode])

  const updateField = (field: keyof VitalsData, value: number) => {
    setVitals(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    setSaving(true)
    onSave({ ...vitals, bmi: calculatedBMI })
    setSaving(false)
    onClose()
  }

  const handleClearAll = () => {
    setVitals({ ...defaultVitals })
  }

  const handleHeightModeToggle = () => {
    if (heightMode === 'ftin' && vitals.height_cm > 0) {
      const totalInches = vitals.height_cm / 2.54
      const ft = Math.floor(totalInches / 12)
      const inch = Math.round(totalInches % 12)
      setVitals(prev => ({ ...prev, height_ft: ft, height_in: inch }))
    } else if (heightMode === 'cm' && (vitals.height_ft > 0 || vitals.height_in > 0)) {
      const cm = (vitals.height_ft * 30.48) + (vitals.height_in * 2.54)
      setVitals(prev => ({ ...prev, height_cm: Math.round(cm) }))
    }
    setHeightMode(prev => prev === 'ftin' ? 'cm' : 'ftin')
  }

  const bmiCategory = useMemo(() => {
    if (calculatedBMI <= 0) return ''
    if (calculatedBMI < 18.5) return 'Underweight'
    if (calculatedBMI < 25) return 'Normal'
    if (calculatedBMI < 30) return 'Overweight'
    return 'Obese'
  }, [calculatedBMI])

  const bmiColor = useMemo(() => {
    if (calculatedBMI <= 0) return 'text-slate-400'
    if (calculatedBMI < 18.5) return 'text-amber-500'
    if (calculatedBMI < 25) return 'text-emerald-500'
    if (calculatedBMI < 30) return 'text-orange-500'
    return 'text-red-500'
  }, [calculatedBMI])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ভাইটালস (Vitals)" size="lg">
      <div className="space-y-5">
        {patientName && (
          <p className="text-sm text-slate-500">
            রোগী: <strong className="text-slate-700">{patientName}</strong>
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Pulse */}
          <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-rose-500" />
              <label className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Pulse</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={vitals.pulse || ''}
                onChange={(e) => updateField('pulse', Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-rose-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400"
                placeholder="72"
                min={0}
                max={300}
              />
              <span className="text-xs text-rose-400 font-medium">bpm</span>
            </div>
          </div>

          {/* BP */}
          <div className="bg-violet-50 rounded-xl p-3 border border-violet-100">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-violet-500" />
              <label className="text-xs font-semibold text-violet-700 uppercase tracking-wider">BP</label>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={vitals.bp_systolic || ''}
                onChange={(e) => updateField('bp_systolic', Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                placeholder="120"
                min={0}
                max={300}
              />
              <span className="text-xs text-violet-400 font-medium">/</span>
              <input
                type="number"
                value={vitals.bp_diastolic || ''}
                onChange={(e) => updateField('bp_diastolic', Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                placeholder="80"
                min={0}
                max={300}
              />
              <span className="text-xs text-violet-400 font-medium">mmHg</span>
            </div>
          </div>

          {/* Weight */}
          <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
            <div className="flex items-center gap-2 mb-2">
              <Weight className="w-4 h-4 text-emerald-500" />
              <label className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Weight</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={vitals.weight || ''}
                onChange={(e) => updateField('weight', Number(e.target.value))}
                step="0.1"
                className="w-full px-2 py-1.5 bg-white border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                placeholder="65"
                min={0}
                max={500}
              />
              <span className="text-xs text-emerald-400 font-medium">kg</span>
            </div>
          </div>

          {/* Height */}
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-blue-500" />
                <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Height</label>
              </div>
              <button
                onClick={handleHeightModeToggle}
                className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors font-medium flex items-center gap-1"
              >
                <ArrowUpDown className="w-3 h-3" />
                {heightMode === 'ftin' ? 'cm' : 'ft/in'}
              </button>
            </div>
            {heightMode === 'ftin' ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={vitals.height_ft || ''}
                  onChange={(e) => updateField('height_ft', Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  placeholder="5"
                  min={0}
                  max={8}
                />
                <span className="text-xs text-blue-400 font-medium">ft</span>
                <input
                  type="number"
                  value={vitals.height_in || ''}
                  onChange={(e) => updateField('height_in', Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  placeholder="6"
                  min={0}
                  max={11}
                />
                <span className="text-xs text-blue-400 font-medium">in</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={vitals.height_cm || ''}
                  onChange={(e) => updateField('height_cm', Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-white border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  placeholder="170"
                  min={0}
                  max={300}
                />
                <span className="text-xs text-blue-400 font-medium">cm</span>
              </div>
            )}
          </div>

          {/* BMI */}
          <div className={`bg-amber-50 rounded-xl p-3 border border-amber-100 ${calculatedBMI > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center">
                <span className="text-[9px] font-bold text-amber-600">BMI</span>
              </div>
              <label className="text-xs font-semibold text-amber-700 uppercase tracking-wider">BMI</label>
              {calculatedBMI > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${bmiColor} bg-white border`}>
                  {bmiCategory}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-sm font-semibold">
                <span className={bmiColor}>
                  {calculatedBMI > 0 ? calculatedBMI : '—'}
                </span>
              </div>
              <span className="text-xs text-amber-400 font-medium">kg/m²</span>
            </div>
          </div>

          {/* SpO2 */}
          <div className="bg-cyan-50 rounded-xl p-3 border border-cyan-100">
            <div className="flex items-center gap-2 mb-2">
              <Droplets className="w-4 h-4 text-cyan-500" />
              <label className="text-xs font-semibold text-cyan-700 uppercase tracking-wider">SpO₂</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={vitals.spo2 || ''}
                onChange={(e) => updateField('spo2', Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-white border border-cyan-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400"
                placeholder="98"
                min={0}
                max={100}
              />
              <span className="text-xs text-cyan-400 font-medium">%</span>
            </div>
          </div>

          {/* Temperature */}
          <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="w-4 h-4 text-orange-500" />
              <label className="text-xs font-semibold text-orange-700 uppercase tracking-wider">Temp</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={vitals.temp || ''}
                onChange={(e) => updateField('temp', Number(e.target.value))}
                step="0.1"
                className="w-full px-2 py-1.5 bg-white border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                placeholder="98.6"
                min={90}
                max={110}
              />
              <span className="text-xs text-orange-400 font-medium">°F</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            onClick={handleClearAll}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            সব মুছুন
          </button>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={onClose}>
              বাতিল
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              <Plus className="w-4 h-4" />
              সংরক্ষণ
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
