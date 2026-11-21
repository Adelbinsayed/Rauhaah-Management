use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

#[cfg(target_os = "windows")]
#[link(name = "winspool")]
extern "system" {
    fn EnumPrintersW(
        flags: u32,
        name: *const u16,
        level: u32,
        p_printer_enum: *mut u8,
        cb_buf: u32,
        pcb_needed: *mut u32,
        pc_returned: *mut u32,
    ) -> i32;

    fn GetDefaultPrinterW(psz_buffer: *mut u16, pcch_buffer: *mut u32) -> i32;

    fn OpenPrinterW(
        p_printer_name: *const u16,
        ph_printer: *mut isize,
        p_default: *const std::ffi::c_void,
    ) -> i32;

    fn StartDocPrinterW(
        h_printer: isize,
        level: u32,
        p_doc_info: *const DOC_INFO_1W,
    ) -> u32;

    fn StartPagePrinter(h_printer: isize) -> i32;

    fn WritePrinter(
        h_printer: isize,
        p_buf: *const u8,
        cb_buf: u32,
        pc_written: *mut u32,
    ) -> i32;

    fn EndPagePrinter(h_printer: isize) -> i32;

    fn EndDocPrinter(h_printer: isize) -> i32;

    fn ClosePrinter(h_printer: isize) -> i32;
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct DOC_INFO_1W {
    p_doc_name: *const u16,
    p_output_file: *const u16,
    p_datatype: *const u16,
}

#[cfg(target_os = "windows")]
#[repr(C)]
struct PRINTER_INFO_2W {
    p_server_name: *const u16,
    p_printer_name: *const u16,
    p_share_name: *const u16,
    p_port_name: *const u16,
    p_driver_name: *const u16,
    p_comment: *const u16,
    p_location: *const u16,
    p_dev_mode: *const std::ffi::c_void,
    p_sep_file: *const u16,
    p_print_processor: *const u16,
    p_datatype: *const u16,
    p_parameters: *const u16,
    p_security_descriptor: *const std::ffi::c_void,
    attributes: u32,
    priority: u32,
    default_priority: u32,
    start_time: u32,
    until_time: u32,
    status: u32,
    c_jobs: u32,
    average_ppm: u32,
}

#[tauri::command]
pub fn get_printers() -> Vec<String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let mut needed: u32 = 0;
        let mut returned: u32 = 0;
        let flags = 0x00000002 | 0x00000004; // PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS

        let _ = EnumPrintersW(
            flags,
            std::ptr::null(),
            2,
            std::ptr::null_mut(),
            0,
            &mut needed,
            &mut returned,
        );

        if needed == 0 {
            return Vec::new();
        }

        let mut buffer: Vec<u8> = vec![0; needed as usize];
        if EnumPrintersW(
            flags,
            std::ptr::null(),
            2,
            buffer.as_mut_ptr(),
            needed,
            &mut needed,
            &mut returned,
        ) != 0
        {
            let info_slice = std::slice::from_raw_parts(
                buffer.as_ptr() as *const PRINTER_INFO_2W,
                returned as usize,
            );
            let mut result = Vec::new();
            for info in info_slice {
                if !info.p_printer_name.is_null() {
                    let mut len = 0;
                    while *info.p_printer_name.add(len) != 0 {
                        len += 1;
                    }
                    let slice = std::slice::from_raw_parts(info.p_printer_name, len);
                    result.push(String::from_utf16_lossy(slice));
                }
            }
            return result;
        }
    }
    Vec::new()
}

#[tauri::command]
pub fn get_default_printer() -> Option<String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let mut size: u32 = 0;
        let _ = GetDefaultPrinterW(std::ptr::null_mut(), &mut size);
        if size > 0 {
            let mut buf: Vec<u16> = vec![0; size as usize];
            if GetDefaultPrinterW(buf.as_mut_ptr(), &mut size) != 0 {
                return Some(String::from_utf16_lossy(&buf[..size as usize - 1]));
            }
        }
    }
    None
}

#[tauri::command]
pub fn print_raw_escpos(printer_name: Option<String>, data: Vec<u8>) -> Result<(), String> {
    if data.is_empty() {
        return Err("Print data buffer is empty".into());
    }

    #[cfg(target_os = "windows")]
    {
        let target_printer = match printer_name {
            Some(ref name) if !name.trim().is_empty() && name != "default" => name.trim().to_string(),
            _ => get_default_printer().ok_or_else(|| "No default printer found on system".to_string())?,
        };

        unsafe {
            let mut wide_name: Vec<u16> = target_printer.encode_utf16().chain(std::iter::once(0)).collect();
            let mut h_printer: isize = 0;

            if OpenPrinterW(wide_name.as_mut_ptr(), &mut h_printer, std::ptr::null()) == 0 {
                return Err(format!("Could not open printer '{}'", target_printer));
            }

            let doc_name: Vec<u16> = "Rauhaah Thermal Receipt\0".encode_utf16().collect();
            let datatype: Vec<u16> = "RAW\0".encode_utf16().collect();
            let doc_info = DOC_INFO_1W {
                p_doc_name: doc_name.as_ptr(),
                p_output_file: std::ptr::null(),
                p_datatype: datatype.as_ptr(),
            };

            let job_id = StartDocPrinterW(h_printer, 1, &doc_info as *const _);
            if job_id == 0 {
                ClosePrinter(h_printer);
                return Err(format!("StartDocPrinterW failed for '{}'", target_printer));
            }

            if StartPagePrinter(h_printer) == 0 {
                EndDocPrinter(h_printer);
                ClosePrinter(h_printer);
                return Err("StartPagePrinter failed".into());
            }

            let mut written: u32 = 0;
            let write_ok = WritePrinter(
                h_printer,
                data.as_ptr(),
                data.len() as u32,
                &mut written,
            );

            EndPagePrinter(h_printer);
            EndDocPrinter(h_printer);
            ClosePrinter(h_printer);

            if write_ok == 0 || written == 0 {
                return Err("WritePrinter failed to send data to thermal printer".into());
            }

            Ok(())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = printer_name;
        let _ = data;
        Err("Direct ESC/POS raw printer is only supported on Windows".into())
    }
}

#[tauri::command]
pub fn print_network_escpos(host: String, port: Option<u16>, data: Vec<u8>) -> Result<(), String> {
    if data.is_empty() {
        return Err("Print data buffer is empty".into());
    }

    let target_port = port.unwrap_or(9100);
    let addr_str = format!("{}:{}", host.trim(), target_port);
    let socket_addr: SocketAddr = addr_str
        .parse()
        .map_err(|e| format!("Invalid network printer address '{}': {}", addr_str, e))?;

    let mut stream = TcpStream::connect_timeout(&socket_addr, Duration::from_secs(4))
        .map_err(|e| format!("Failed to connect to network thermal printer at {}: {}", addr_str, e))?;

    stream
        .write_all(&data)
        .map_err(|e| format!("Failed writing ESC/POS data to printer: {}", e))?;

    stream
        .flush()
        .map_err(|e| format!("Failed flushing socket to printer: {}", e))?;

    Ok(())
}
