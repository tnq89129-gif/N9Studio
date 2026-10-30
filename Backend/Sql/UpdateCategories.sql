-- Apply inside the explicit upgrade transaction. Preserves all category IDs and product relations.
IF OBJECT_ID(N'dbo.Categories', N'U') IS NULL
    THROW 51000, 'Categories table is missing. Check the configured database before upgrading.', 1;
IF COL_LENGTH(N'dbo.Categories', N'Code') IS NULL
    EXEC(N'ALTER TABLE dbo.Categories ADD Code nvarchar(60) NOT NULL CONSTRAINT DF_Categories_Code DEFAULT N'''';');
IF COL_LENGTH(N'dbo.Categories', N'Description') IS NULL
    EXEC(N'ALTER TABLE dbo.Categories ADD Description nvarchar(240) NOT NULL CONSTRAINT DF_Categories_Description DEFAULT N'''';');
IF COL_LENGTH(N'dbo.Categories', N'IsActive') IS NULL
    EXEC(N'ALTER TABLE dbo.Categories ADD IsActive bit NOT NULL CONSTRAINT DF_Categories_IsActive DEFAULT 1;');
EXEC(N'UPDATE dbo.Categories SET Code = N''danh-muc-'' + CONVERT(nvarchar(20), Id) WHERE Code = N'''';');
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Categories') AND name=N'IX_Categories_Code')
    EXEC(N'CREATE UNIQUE INDEX IX_Categories_Code ON dbo.Categories(Code);');
