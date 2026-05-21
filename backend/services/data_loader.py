from io import BytesIO

import pandas as pd
from fastapi import HTTPException, UploadFile


async def read_uploaded_csv(file: UploadFile) -> pd.DataFrame:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo CSV válido.")
    try:
        contents = await file.read()
        return pd.read_csv(BytesIO(contents))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Não foi possível ler o CSV: {exc}",
        ) from exc
