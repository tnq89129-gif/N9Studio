IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
    THROW 51002, 'Products table is missing. Check the configured database.', 1;
IF COL_LENGTH(N'dbo.Products', N'Tag') IS NULL
    EXEC(N'ALTER TABLE dbo.Products ADD Tag nvarchar(30) NOT NULL CONSTRAINT DF_Products_Tag DEFAULT N'''';');
