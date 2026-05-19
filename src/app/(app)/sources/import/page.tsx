import ExcelImporter from '@/components/sources/ExcelImporter'

export default function ImportPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>📥 엑셀로 취재원 가져오기</h1>
        <p className="text-sm mt-1" style={{ color: '#687898' }}>
          기존에 관리하던 엑셀 파일을 올리면 AI가 자동으로 컬럼을 분류해드립니다
        </p>
      </div>
      <ExcelImporter />
    </div>
  )
}
