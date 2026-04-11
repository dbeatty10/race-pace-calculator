import { useCallback } from "react";

interface CourseUploadProps {
  onFileLoaded: (gpxData: string, fileName: string) => void;
}

export function CourseUpload({ onFileLoaded }: CourseUploadProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onFileLoaded(reader.result, file.name);
        }
      };
      reader.readAsText(file);
    },
    [onFileLoaded]
  );

  return (
    <div className="form-group">
      <label htmlFor="gpx-upload">Course file (GPX)</label>
      <input
        id="gpx-upload"
        type="file"
        accept=".gpx"
        onChange={handleChange}
      />
    </div>
  );
}
