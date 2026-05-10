"use client";

import {
	Calendar,
	Camera,
	CheckCheck,
	Copy,
	Edit3,
	Loader2,
	Mail,
	MapPin,
	Phone,
	Save,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { useEmbed } from "../../../context/EmbedContext";
import { useToast } from "../../../hooks/use-toast";
import { getInitials } from "../../../lib/initials";

type ProfileExtra = {
	display_name: string | null;
	phone: string | null;
	location: string | null;
	job_title: string | null;
	avatar_url: string | null;
	plan: string | null;
};

const PLAN_LABEL: Record<string, string> = {
	starter: "Plano Starter",
	pro: "Plano Pro",
	business: "Plano Business",
};

function formatMemberSince(iso: string | undefined) {
	if (!iso) return "—";
	try {
		return new Date(iso).toLocaleDateString("pt-BR", {
			month: "long",
			year: "numeric",
		});
	} catch {
		return "—";
	}
}

export default function UserProfile() {
	const { user, refreshProfile } = useAuth();
	const { mode, host, session } = useEmbed();
	const { toast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [editing, setEditing] = useState(false);
	const [isCopyID, setIsCopyID] = useState(false);

	const [data, setData] = useState<ProfileExtra>({
		display_name: null,
		phone: null,
		location: null,
		job_title: null,
		avatar_url: null,
		plan: "starter",
	});
	const [draft, setDraft] = useState<ProfileExtra>(data);

	const memberSince = useMemo(
		() => formatMemberSince(user?.created_at),
		[user?.created_at],
	);
	const userIdShort = useMemo(() => {
		if (!user?.id) return "";
		return `usr_${user.id.replace(/-/g, "").slice(0, 18)}`;
	}, [user]);

	useEffect(() => {
		const supabase = getSupabase();
		if (!supabase || !user) {
			return;
		}
		let cancelled = false;
		supabase
			.from("profiles")
			.select("display_name,phone,location,job_title,avatar_url,plan")
			.eq("id", user.id)
			.maybeSingle()
			.then(({ data: row, error }) => {
				if (cancelled) return;
				if (error) {
					console.error(error);
					toast({
						title: "Erro ao carregar perfil",
						description: error.message,
					});
				}
				const next: ProfileExtra = {
					display_name: row?.display_name ?? null,
					phone: row?.phone ?? null,
					location: row?.location ?? null,
					job_title: row?.job_title ?? null,
					avatar_url: row?.avatar_url ?? null,
					plan: row?.plan ?? "starter",
				};
				setData(next);
				setDraft(next);
				setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [user, toast]);

	async function handleSave() {
		const supabase = getSupabase();
		if (!supabase || !user) return;
		setSaving(true);
		const { error } = await supabase
			.from("profiles")
			.update({
				display_name: draft.display_name,
				phone: draft.phone,
				location: draft.location,
				job_title: draft.job_title,
			})
			.eq("id", user.id);
		setSaving(false);
		if (error) {
			toast({ title: "Erro ao salvar", description: error.message });
			return;
		}
		setData(draft);
		setEditing(false);
		await refreshProfile();
		toast({ title: "Perfil atualizado" });
	}

	function handleCancel() {
		setDraft(data);
		setEditing(false);
	}

	async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file || !user) return;
		const supabase = getSupabase();
		if (!supabase) return;

		if (file.size > 2 * 1024 * 1024) {
			toast({ title: "Arquivo muito grande", description: "Máx. 2MB" });
			return;
		}

		setUploading(true);
		const ext = file.name.split(".").pop() || "png";
		const path = `${user.id}/avatar-${Date.now()}.${ext}`;
		const { error: upErr } = await supabase.storage
			.from("avatars")
			.upload(path, file, { upsert: true, contentType: file.type });

		if (upErr) {
			setUploading(false);
			toast({ title: "Erro ao enviar imagem", description: upErr.message });
			return;
		}

		const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
		const url = pub.publicUrl;

		const { error: updErr } = await supabase
			.from("profiles")
			.update({ avatar_url: url })
			.eq("id", user.id);
		setUploading(false);

		if (updErr) {
			toast({ title: "Erro ao salvar avatar", description: updErr.message });
			return;
		}
		setData((d) => ({ ...d, avatar_url: url }));
		setDraft((d) => ({ ...d, avatar_url: url }));
		await refreshProfile();
		toast({ title: "Foto atualizada" });
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	async function handleAvatarRemove() {
		if (!user) return;
		const supabase = getSupabase();
		if (!supabase) return;
		setUploading(true);

		// best-effort: remover arquivos antigos da pasta do usuário
		try {
			const { data: list } = await supabase.storage
				.from("avatars")
				.list(user.id);
			if (list && list.length > 0) {
				await supabase.storage
					.from("avatars")
					.remove(list.map((f) => `${user.id}/${f.name}`));
			}
		} catch (err) {
			console.warn("falha ao limpar arquivos antigos:", err);
		}

		const { error: updErr } = await supabase
			.from("profiles")
			.update({ avatar_url: null })
			.eq("id", user.id);
		setUploading(false);

		if (updErr) {
			toast({ title: "Erro ao remover foto", description: updErr.message });
			return;
		}
		setData((d) => ({ ...d, avatar_url: null }));
		setDraft((d) => ({ ...d, avatar_url: null }));
		await refreshProfile();
		toast({ title: "Foto removida" });
	}

	if (!user) return null;

	const initials = getInitials(data.display_name || user.email, "?");

	return (
		<div className="relative box-border w-full overflow-hidden flex items-center justify-center ">
			<div className=" w-full  flex flex-col items-center justify-start box-border overflow-auto h-full ">
				<div className="relative flex w-full ">
					<div className="relative flex w-full h-32 flex-col items-center bg-gradient-to-b from-[#1f2937] to-[#06B6D4] p-4 shadow-lg">
						<div className="absolute -bottom-11 border-4 border-white bg-[#06B6D4] rounded-full p-0 shadow-md">
							<div className="relative">
								{data.avatar_url ? (
									<img
										src={data.avatar_url}
										alt="Avatar"
										className="w-28 h-28 rounded-full object-cover"
									/>
								) : (
									<div className="w-28 h-28 rounded-full bg-[#06B6D4] flex items-center justify-center text-white text-3xl font-semibold select-none">
										{initials}
									</div>
								)}
								<button
									type="button"
									onClick={() => fileInputRef.current?.click()}
									disabled={uploading}
									className="absolute -bottom-1 -right-1 w-8 h-8 text-white border-2 border-white bg-[#06B6D4] rounded-full p-1.5 cursor-pointer disabled:opacity-60"
									title={data.avatar_url ? "Trocar foto" : "Adicionar foto"}
								>
									{uploading ? (
										<Loader2 className="w-full h-full animate-spin" />
									) : (
										<Camera className="w-full h-full" />
									)}
								</button>
								{data.avatar_url && !uploading && (
									<button
										type="button"
										onClick={handleAvatarRemove}
										disabled={uploading}
										className="absolute -bottom-1 -left-1 w-8 h-8 text-white border-2 border-white bg-red-500 hover:bg-red-600 rounded-full p-1.5 cursor-pointer disabled:opacity-60"
										title="Remover foto"
									>
										<Trash2 className="w-full h-full" />
									</button>
								)}
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									className="hidden"
									onChange={handleAvatarChange}
								/>
							</div>
						</div>
					</div>
				</div>
				<div className="flex flex-col w-full  pb-4 px-6 items-center justify-center  bg-gray-200">
					<div className="w-full flex flex-col items-center py-14  rounded-b-2xl shadow-md bg-white">
						<div className="flex flex-col items-center justify-center gap-6 w-full h-full">
							<div className="flex flex-col items-center gap-2 w-full">
								{editing ? (
									<input
										value={draft.display_name ?? ""}
										onChange={(e) =>
											setDraft({ ...draft, display_name: e.target.value })
										}
										placeholder="Seu nome"
										className="text-gray-800 text-center border rounded-md px-2 py-1"
									/>
								) : (
									<span className="text-gray-800">
										{data.display_name || user.email}
									</span>
								)}
								{editing ? (
									<input
										value={draft.job_title ?? ""}
										onChange={(e) =>
											setDraft({ ...draft, job_title: e.target.value })
										}
										placeholder="Seu cargo"
										className="text-gray-500 text-sm text-center border rounded-md px-2 py-1"
									/>
								) : (
									<span className="text-gray-500 text-sm">
										{data.job_title || "—"}
									</span>
								)}
								<div className="flex rounded-full h-6 bg-[#cdffd2] px-6 py-2 items-center justify-center">
									<span className="text-gray-700">
										{PLAN_LABEL[data.plan ?? "starter"] ?? "Plano Starter"}
									</span>
								</div>
							</div>
							<div className="mt-4 py-2 w-[90%] border-t border-gray-300"></div>
							<div className="w-[90%] flex flex-col gap-3 items-start justify-start">
								<div className="flex items-center justify-center gap-2 w-full">
									<div className="flex items-center p-2 rounded-md bg-gray-200/40">
										<Mail className="inline-block w-[24px] h-[24px] text-gray-500" />
									</div>
									<div className="flex flex-col -space-y-1 flex-1 w-full items-center ">
										<span className="text-gray-800">Email</span>
										<span className="text-gray-500 text-sm underline underline-offset-4">
											{user.email}
										</span>
									</div>
								</div>
								<div className="flex items-center justify-center gap-2 w-full">
									<div className="flex items-center p-2 rounded-md bg-gray-200/40">
										<Phone className="inline-block w-[24px] h-[24px] text-gray-500" />
									</div>
									<div className="flex flex-col -space-y-1 flex-1 w-full items-center">
										<span className="text-gray-800">Telefone</span>
										{editing ? (
											<input
												value={draft.phone ?? ""}
												onChange={(e) =>
													setDraft({ ...draft, phone: e.target.value })
												}
												placeholder="(00) 00000-0000"
												className="text-gray-700 text-sm border rounded-md px-2 py-1 mt-1"
											/>
										) : (
											<span className="text-gray-500 text-sm">
												{data.phone || "—"}
											</span>
										)}
									</div>
								</div>

								<div className="flex items-center justify-center gap-2 w-full">
									<div className="flex items-center p-2 rounded-md bg-gray-200/40">
										<MapPin className="inline-block w-[24px] h-[24px] text-gray-500" />
									</div>
									<div className="flex flex-col -space-y-1 flex-1 w-full items-center">
										<span className="text-gray-800">Localização</span>
										{editing ? (
											<input
												value={draft.location ?? ""}
												onChange={(e) =>
													setDraft({ ...draft, location: e.target.value })
												}
												placeholder="Cidade, Estado"
												className="text-gray-700 text-sm border rounded-md px-2 py-1 mt-1"
											/>
										) : (
											<span className="text-gray-500 text-sm">
												{data.location || "—"}
											</span>
										)}
									</div>
								</div>
								<div className="flex items-center justify-center gap-2 w-full">
									<div className="flex items-center p-2 rounded-md bg-gray-200/40">
										<Calendar className="inline-block w-[24px] h-[24px] text-gray-500" />
									</div>
									<div className="flex flex-col -space-y-1 flex-1 w-full items-center">
										<span className="text-gray-800">Membro desde</span>
										<span className="text-gray-500 text-sm">{memberSince}</span>
									</div>
								</div>
							</div>
							<div className="mt-4 py-2 w-[90%] border-t border-gray-300"></div>
							<div className="w-[90%] flex flex-col gap-4 items-center justify-start">
								<div className="w-full flex flex-col gap-1 items-start justify-start">
									<span className="text-gray-800 w-full text-center">
										ID do Usuário
									</span>
									<div className="w-full flex items-center rounded-2xl justify-between bg-gray-200/40 py-2 px-4">
										<p className="text-center text-gray-500 w-full text-sm">
											{userIdShort}
										</p>
										<button
											onClick={() => {
												navigator.clipboard.writeText(user.id);
												setIsCopyID(true);
												setTimeout(() => setIsCopyID(false), 2000);
											}}
											className="flex items-center justify-center p-1 rounded-md bg-none transition-colors duration-300"
										>
											{isCopyID ? (
												<CheckCheck className="w-5 h-5 text-[#59fc6a] cursor-pointer" />
											) : (
												<Copy className="w-5 h-5 text-gray-500 cursor-pointer" />
											)}
										</button>
									</div>
								</div>

								{editing ? (
									<div className="w-full flex gap-2">
										<button
											onClick={handleCancel}
											disabled={saving}
											className="flex-1 items-center justify-center px-4 flex py-1.5 rounded-lg bg-gray-300 text-gray-700 hover:bg-gray-400 transition-colors duration-300 disabled:opacity-60"
										>
											<X className="w-4 h-4 mr-2" /> Cancelar
										</button>
										<button
											onClick={handleSave}
											disabled={saving || loading}
											className="flex-1 items-center justify-center px-4 flex py-1.5 rounded-lg bg-[#06B6D4] text-white hover:bg-[#1f2937] transition-colors duration-300 disabled:opacity-60"
										>
											{saving ? (
												<Loader2 className="w-4 h-4 mr-2 animate-spin" />
											) : (
												<Save className="w-4 h-4 mr-2" />
											)}
											{saving ? "Salvando..." : "Salvar"}
										</button>
									</div>
								) : (
									<button
										onClick={() => {
											setDraft(data);
											setEditing(true);
										}}
										disabled={loading}
										className="w-full items-center justify-center px-4 flex py-1.5 rounded-lg bg-[#06B6D4] text-white hover:bg-[#1f2937] transition-colors duration-300 disabled:opacity-60"
									>
										<Edit3 className="w-4 h-4 mr-2" /> Editar Perfil
									</button>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
