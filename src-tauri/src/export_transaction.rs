use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub struct ExportAsset {
    pub name: String,
    pub bytes: Vec<u8>,
}

fn real_entry(path: &Path, directory: bool) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if metadata.file_attributes() & 0x400 != 0 {
                    return Err("Export paths cannot be symbolic links or junctions.".into());
                }
            }
            if metadata.is_symlink()
                || (directory && !metadata.is_dir())
                || (!directory && !metadata.is_file())
            {
                return Err("An export destination has the wrong type.".into());
            }
            Ok(true)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct TestDirectory(PathBuf);
    impl TestDirectory {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("anehalo-export-test-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&path).expect("create test folder");
            Self(path)
        }
    }
    impl Drop for TestDirectory {
        fn drop(&mut self) {
            fs::remove_dir_all(&self.0).expect("remove test folder");
        }
    }
    #[test]
    fn writes_a_file_without_creating_an_assets_folder() {
        let directory = TestDirectory::new();
        commit_export(&directory.0.join("Note.pdf"), b"PDF", &[]).expect("save PDF");
        assert_eq!(
            fs::read(directory.0.join("Note.pdf")).expect("read PDF"),
            b"PDF"
        );
        commit_export(&directory.0.join("Note.pdf"), b"REPLACED PDF", &[])
            .expect("replace PDF atomically");
        assert_eq!(
            fs::read(directory.0.join("Note.pdf")).expect("read replaced PDF"),
            b"REPLACED PDF"
        );
        assert_eq!(
            fs::read_dir(&directory.0).expect("read directory").count(),
            1
        );
    }
    #[test]
    fn exports_images_and_preserves_unrelated_existing_assets() {
        let directory = TestDirectory::new();
        let assets = directory.0.join("Note_assets");
        fs::create_dir(&assets).expect("create assets");
        fs::write(assets.join("unrelated.png"), b"original").expect("write unrelated");
        commit_export(
            &directory.0.join("Note.md"),
            b"![Image](Note_assets/image.png)",
            &[ExportAsset {
                name: "image.png".into(),
                bytes: b"image".to_vec(),
            }],
        )
        .expect("save images");
        assert_eq!(
            fs::read(assets.join("image.png")).expect("read image"),
            b"image"
        );
        assert_eq!(
            fs::read(assets.join("unrelated.png")).expect("read unrelated"),
            b"original"
        );
    }
    #[test]
    fn restores_overwritten_assets_when_a_later_image_cannot_be_installed() {
        let directory = TestDirectory::new();
        let destination = directory.0.join("Note.md");
        fs::write(&destination, b"old note").expect("write old note");
        let assets = directory.0.join("Note_assets");
        fs::create_dir(&assets).expect("create assets");
        fs::write(assets.join("first.png"), b"old image").expect("write old image");
        fs::create_dir(assets.join("blocked.png")).expect("create blocker");
        let result = commit_export(
            &destination,
            b"new note",
            &[
                ExportAsset {
                    name: "first.png".into(),
                    bytes: b"new image".to_vec(),
                },
                ExportAsset {
                    name: "blocked.png".into(),
                    bytes: b"blocked".to_vec(),
                },
            ],
        );
        assert!(result.is_err());
        assert_eq!(
            fs::read(&destination).expect("read original note"),
            b"old note"
        );
        assert_eq!(
            fs::read(assets.join("first.png")).expect("read original image"),
            b"old image"
        );
        assert_eq!(
            fs::read_dir(&directory.0).expect("read directory").count(),
            2
        );
    }
    #[test]
    fn rejects_asset_traversal_before_writing_anything() {
        let directory = TestDirectory::new();
        assert!(
            commit_export(
                &directory.0.join("Note.md"),
                b"note",
                &[ExportAsset {
                    name: "../outside.png".into(),
                    bytes: vec![1]
                }]
            )
            .is_err()
        );
        assert_eq!(
            fs::read_dir(&directory.0).expect("read directory").count(),
            0
        );
    }
}
fn write_new(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| error.to_string())?;
    file.write_all(bytes)
        .and_then(|()| file.sync_all())
        .map_err(|error| error.to_string())
}

pub fn commit_export(
    destination: &Path,
    content: &[u8],
    assets: &[ExportAsset],
) -> Result<(), String> {
    let parent = destination
        .parent()
        .ok_or("The export folder is missing.")?;
    let assets_path = parent.join(format!(
        "{}_assets",
        destination
            .file_stem()
            .ok_or("Invalid export name.")?
            .to_string_lossy()
    ));
    for asset in assets {
        let name = Path::new(&asset.name);
        if name.file_name().and_then(|value| value.to_str()) != Some(asset.name.as_str())
            || asset.name.starts_with('.')
            || asset.name.contains(['/', '\\', ':'])
        {
            return Err("Invalid export image name.".into());
        }
    }
    real_entry(destination, false)?;
    if !assets.is_empty() {
        real_entry(&assets_path, true)?;
    }
    let staging = parent.join(format!(".anehalo-export-{}.tmp", uuid::Uuid::new_v4()));
    fs::create_dir(&staging).map_err(|error| error.to_string())?;
    let mut installed_assets: Vec<PathBuf> = Vec::new();
    let mut backups: Vec<(PathBuf, PathBuf)> = Vec::new();
    let mut created_assets = false;
    let result = (|| {
        write_new(&staging.join("note"), content)?;
        for (index, asset) in assets.iter().enumerate() {
            write_new(&staging.join(format!("image-{index}")), &asset.bytes)?;
        }
        if !assets.is_empty() && !assets_path.exists() {
            fs::create_dir(&assets_path).map_err(|error| error.to_string())?;
            created_assets = true;
        }
        for (index, asset) in assets.iter().enumerate() {
            let target = assets_path.join(&asset.name);
            let backup = if real_entry(&target, false)? {
                let backup = staging.join(format!("backup-{index}"));
                fs::copy(&target, &backup).map_err(|error| error.to_string())?;
                Some(backup)
            } else {
                None
            };
            fs::rename(staging.join(format!("image-{index}")), &target)
                .map_err(|error| error.to_string())?;
            if let Some(backup) = backup {
                backups.push((backup, target.clone()));
            }
            installed_assets.push(target);
        }
        real_entry(destination, false)?;
        fs::rename(staging.join("note"), destination).map_err(|error| error.to_string())?;
        Ok::<(), String>(())
    })();
    if let Err(original) = result {
        let mut errors = vec![original];
        for path in installed_assets.iter().rev() {
            if let Err(error) = fs::remove_file(path) {
                errors.push(error.to_string());
            }
        }
        for (backup, target) in backups.iter().rev() {
            if let Err(error) = fs::rename(backup, target) {
                errors.push(error.to_string());
            }
        }
        if created_assets && let Err(error) = fs::remove_dir(&assets_path) {
            errors.push(error.to_string());
        }
        if errors.len() == 1 {
            if let Err(error) = fs::remove_dir_all(&staging) {
                errors.push(error.to_string());
            }
        } else {
            errors.push(format!("Recovery files remain in {}.", staging.display()));
        }
        return Err(errors.join(" "));
    }
    fs::remove_dir_all(staging).map_err(|error| {
        format!("The export is complete, but temporary backups could not be removed: {error}")
    })
}
